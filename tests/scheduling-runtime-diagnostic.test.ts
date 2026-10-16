import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  blockedDiagnosticReport, diagnosticExecutionScope, diagnosticLimits, diagnosticResultNames,
  schedulingCatalogQuery, schedulingSchemaContract, schedulingSchemaStatus,
} from '../modules/scheduling/activation/runtime-diagnostic-contract'

const now = 1_800_000_000_000
const approval = { sourceSha: 'a'.repeat(40), deploymentId: 'dpl_fixture123', startsAt: now - 1_000, expiresAt: now + 60_000 }
const environment = {
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC',
  VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling', VERCEL_GIT_COMMIT_SHA: approval.sourceSha,
  VERCEL_DEPLOYMENT_ID: approval.deploymentId,
}

describe('inert runtime diagnostic execution contract', () => {
  it('matches only the pinned project, staging Preview, reviewed SHA and deployment within the window', () => {
    expect(diagnosticExecutionScope(environment, approval, now)).toBe('PASS')
  })
  it.each(Object.keys(environment))('fails closed when %s is missing', key => {
    expect(diagnosticExecutionScope({ ...environment, [key]: undefined }, approval, now)).toBe('BLOCKED')
  })
  it.each([
    { VERCEL: '0' }, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'development' },
    { VERCEL_PROJECT_ID: 'prj_CXskPmbNMIl5Idh6e6c2UUv2eanm' },
    { VERCEL_GIT_COMMIT_REF: 'main' }, { VERCEL_GIT_COMMIT_REF: 'v0/staging-runtime-gate' },
    { VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) }, { VERCEL_DEPLOYMENT_ID: 'dpl_other' },
  ])('rejects wrong deployment evidence %j', patch => {
    expect(diagnosticExecutionScope({ ...environment, ...patch }, approval, now)).toBe('BLOCKED')
  })
  it.each([
    { sourceSha: '' }, { sourceSha: 'not-a-sha' }, { deploymentId: '' },
    { startsAt: now + 1 }, { expiresAt: now }, { expiresAt: now - 1 },
    { expiresAt: approval.startsAt + diagnosticLimits.windowMs + 1 },
    { startsAt: Number.NaN }, { expiresAt: Infinity }, { startsAt: -1 },
    { startsAt: now - 0.5 },
  ])('rejects invalid or expired approval %j', patch => {
    expect(diagnosticExecutionScope(environment, { ...approval, ...patch }, now)).toBe('BLOCKED')
  })
  it.each([NaN, Infinity, -Infinity, now + 0.5])('rejects invalid clock %s', clock => {
    expect(diagnosticExecutionScope(environment, approval, clock)).toBe('BLOCKED')
  })
  it('has conservative nested time limits and a maximum five-minute execution window', () => {
    expect(diagnosticLimits.connectionMs).toBeLessThan(diagnosticLimits.pathMs)
    expect(diagnosticLimits.statementMs).toBeLessThan(diagnosticLimits.pathMs)
    expect(2 * diagnosticLimits.pathMs).toBeLessThan(diagnosticLimits.operationMs)
    expect(diagnosticLimits.operationMs).toBeLessThan(diagnosticLimits.functionMs)
    expect(diagnosticLimits.windowMs).toBe(300_000)
  })
})

describe('migration 001–009 catalog contract, without a database', () => {
  it('accepts a complete fixture without changing it', () => {
    const before = JSON.stringify(schedulingSchemaContract)
    expect(schedulingSchemaStatus(schedulingSchemaContract)).toBe('PASS')
    expect(JSON.stringify(schedulingSchemaContract)).toBe(before)
  })
  for (const column of schedulingSchemaContract) {
    it(`blocks missing ${column.table_name}.${column.column_name}`, () => {
      expect(schedulingSchemaStatus(schedulingSchemaContract.filter(item => item !== column))).toBe('BLOCKED')
    })
  }
  it('blocks wrong column types and duplicate metadata', () => {
    expect(schedulingSchemaStatus(schedulingSchemaContract.map((row, index) => index ? row : { ...row, type_name: 'text' }))).toBe('BLOCKED')
    expect(schedulingSchemaStatus([...schedulingSchemaContract, schedulingSchemaContract[0]])).toBe('BLOCKED')
  })
  it.each([null, undefined, {}, [], [null], ['secret'], [{ table_name: 'secret\nraw' }], Array(2049).fill({})])('blocks malformed or excessive metadata %#', rows => {
    expect(schedulingSchemaStatus(rows)).toBe('BLOCKED')
  })
  it('checks only base-table metadata and never reads application records', () => {
    expect(schedulingCatalogQuery.trim().startsWith('SELECT ')).toBe(true)
    expect(schedulingCatalogQuery).toContain("c.relkind IN ('r', 'p')")
    expect(schedulingCatalogQuery).toContain("tn.nspname = 'pg_catalog'")
    expect(schedulingCatalogQuery).toContain('LIMIT 2049')
    expect(schedulingCatalogQuery).not.toMatch(/;|\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|CALL)\b/i)
    expect(schedulingCatalogQuery).not.toMatch(/FROM\s+rrd_scheduling\./i)
  })
  it('independently matches all declared columns and types in source migrations 001–009', () => {
    const types: Record<string, string> = { uuid: 'uuid', text: 'text', integer: 'int4', boolean: 'bool', timestamptz: 'timestamptz', jsonb: 'jsonb', date: 'date', tstzrange: 'tstzrange' }
    const files = ['001_scheduling', '002_admin_calendar', '003_configuration', '004_notifications', '005_customer_management', '006_website_integration', '007_multitenant', '008_branding_responses', '009_platform_management']
    const found = new Set<string>()
    function record(table: string, name: string, type: string) {
      if (types[type]) found.add(`${table}.${name}:${types[type]}`)
    }
    function parts(body: string) {
      let depth = 0, quoted = false, start = 0
      const output: string[] = []
      for (let i = 0; i < body.length; i++) {
        if (body[i] === "'") quoted = !quoted
        if (quoted) continue
        if (body[i] === '(') depth++
        if (body[i] === ')') depth--
        if (body[i] === ',' && depth === 0) { output.push(body.slice(start, i)); start = i + 1 }
      }
      return [...output, body.slice(start)]
    }
    for (const file of files) {
      const sql = readFileSync(new URL(`../modules/scheduling/migrations/${file}.sql`, import.meta.url), 'utf8').replace(/--[^\n]*/g, '')
      for (const table of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?rrd_scheduling\.(\w+)\s*\(([\s\S]*?)\);/g)) {
        for (const part of parts(table[2])) {
          const column = part.trim().match(/^(\w+)\s+(\w+)/)
          if (column) record(table[1], column[1], column[2])
        }
      }
      for (const table of sql.matchAll(/ALTER TABLE rrd_scheduling\.(\w+)\s+([^;]+);/g)) {
        for (const column of table[2].matchAll(/ADD COLUMN (\w+)\s+(\w+)/g)) record(table[1], column[1], column[2])
      }
    }
    expect([...found].sort()).toEqual(schedulingSchemaContract.map(row => `${row.table_name}.${row.column_name}:${row.type_name}`).sort())
  })
})

describe('blocked and sanitized preparation report', () => {
  it('cannot turn fixture evidence into authorization or runtime readiness', () => {
    const evidence = Object.fromEntries(diagnosticResultNames.map(name => [name, 'PASS']))
    const report = blockedDiagnosticReport(evidence)
    expect(report.status).toBe('BLOCKED')
    expect(report.checks.OPERATOR_AUTHORIZATION).toBe('BLOCKED')
    expect(report.reason).toBe('AUTHORIZATION_UNAVAILABLE')
  })
  it('never reflects secrets, cookies, SQL results, errors or unknown fields', () => {
    const sensitive = 'SYNTHETIC_SECRET_DO_NOT_REFLECT'
    const report = blockedDiagnosticReport({ connection: sensitive, cookie: sensitive, error: sensitive, DATABASE_DESTINATION: sensitive, OPERATOR_AUTHORIZATION: 'PASS' })
    expect(JSON.stringify(report)).not.toContain(sensitive)
    expect(Object.keys(report.checks)).toEqual(diagnosticResultNames)
    expect(Object.values(report.checks).every(status => status === 'BLOCKED')).toBe(true)
  })
  it.each([null, undefined, 'PASS', 1, []])('fails closed without evidence %#', evidence => {
    expect(blockedDiagnosticReport(evidence).status).toBe('BLOCKED')
  })
})
