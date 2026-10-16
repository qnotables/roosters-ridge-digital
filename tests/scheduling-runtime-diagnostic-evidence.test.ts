import { describe, expect, it } from 'vitest'
import { blockedDiagnosticReport, schedulingSchemaContract } from '../modules/scheduling/activation/runtime-diagnostic-contract'
import {
  diagnosticEnablementRequirements, diagnosticPathEvidence, diagnosticReadOnlyPlan, diagnosticRequestStatus,
} from '../modules/scheduling/activation/runtime-diagnostic-evidence'

const request = {
  method: 'POST', url: 'https://preview.invalid/api/diagnostic', origin: 'https://preview.invalid',
  approvedOrigin: 'https://preview.invalid', hasBody: false, contentLength: null, transferEncoding: null,
}
const approval = {
  hostname: 'direct.fixture.invalid',
  identity: { database: 'neondb', role: 'fixture_role', server: 'fixture_authoritative_server' },
  serverIdentityAuthoritative: true,
}
const evidence = {
  connected: true, tlsAuthorized: true, tlsHostname: approval.hostname,
  identity: approval.identity, transactionReadOnly: 'on', catalogRows: schedulingSchemaContract,
  elapsedMs: 100, closed: true,
}

describe('offline-only request-envelope contract', () => {
  it('accepts an empty same-origin POST envelope without granting authorization', () => {
    expect(diagnosticRequestStatus(request)).toBe('PASS')
    expect(blockedDiagnosticReport({ EXECUTION_SCOPE: 'PASS', OPERATOR_AUTHORIZATION: 'PASS' }).status).toBe('BLOCKED')
  })
  it.each([
    { method: 'GET' }, { method: 'HEAD' }, { method: 'OPTIONS' }, { method: 'post' },
    { origin: null }, { origin: 'null' }, { origin: 'https://attacker.invalid' },
    { url: 'https://attacker.invalid/api/diagnostic' }, { url: 'not a URL' },
    { url: request.url + '?sql=SELECT' }, { url: request.url + '?' },
    { url: request.url + '#' }, { url: request.url + '#fragment' },
    { url: 'https://user:password@preview.invalid/api/diagnostic' },
    { approvedOrigin: 'http://preview.invalid' }, { approvedOrigin: 'https://preview.invalid/path' },
    { approvedOrigin: 'https://preview.invalid/' }, { hasBody: true },
    { contentLength: '1' }, { contentLength: '-1' }, { contentLength: '00' },
    { contentLength: ' 0' }, { contentLength: 'NaN' }, { transferEncoding: 'chunked' },
    { transferEncoding: '' },
  ])('blocks unsafe request envelope %j', patch => {
    expect(diagnosticRequestStatus({ ...request, ...patch })).toBe('BLOCKED')
  })
  it('permits only canonical zero content length', () => {
    expect(diagnosticRequestStatus({ ...request, contentLength: '0' })).toBe('PASS')
  })
})

describe('fixture-only path evidence assessment', () => {
  it('assesses a complete fixture but cannot enable diagnostic authorization', () => {
    expect(diagnosticPathEvidence(evidence, approval).status).toBe('PASS')
    expect(blockedDiagnosticReport(diagnosticPathEvidence(evidence, approval)).status).toBe('BLOCKED')
  })
  it.each([
    { connected: false }, { tlsAuthorized: false }, { tlsHostname: 'attacker.invalid' },
    { transactionReadOnly: 'off' }, { transactionReadOnly: 'true' }, { transactionReadOnly: '' },
    { catalogRows: [] }, { catalogRows: null }, { closed: false },
    { elapsedMs: 15_000 }, { elapsedMs: 15_001 }, { elapsedMs: -1 },
    { elapsedMs: NaN }, { elapsedMs: Infinity }, { elapsedMs: 1.5 },
    { identity: { ...approval.identity, database: 'postgres' } },
    { identity: { ...approval.identity, role: 'other_role' } },
    { identity: { ...approval.identity, server: 'unproven_server' } },
  ])('blocks incomplete or unsafe path evidence %#', patch => {
    expect(diagnosticPathEvidence({ ...evidence, ...patch }, approval).status).toBe('BLOCKED')
  })
  it.each([
    { serverIdentityAuthoritative: false }, { hostname: '' }, { hostname: '*' },
    { hostname: 'direct.fixture.invalid.evil' },
    { identity: { ...approval.identity, server: '' } },
    { identity: { ...approval.identity, role: '' } },
    { identity: { ...approval.identity, database: 'postgres' } },
  ])('does not infer identity from transport or untrusted expectations %#', patch => {
    expect(diagnosticPathEvidence(evidence, { ...approval, ...patch }).status).toBe('BLOCKED')
  })
  it('never claims downstream checks pass after TLS failure', () => {
    expect(diagnosticPathEvidence({ ...evidence, tlsAuthorized: false }, approval)).toEqual({
      status: 'BLOCKED', connection: 'PASS', tls: 'BLOCKED', identity: 'BLOCKED',
      readOnly: 'BLOCKED', schema: 'BLOCKED', cleanup: 'PASS',
    })
  })
  it('sanitizes raw identity and catalog data', () => {
    const marker = 'SYNTHETIC_SENSITIVE_VALUE'
    const result = diagnosticPathEvidence({ ...evidence, identity: { ...evidence.identity, role: marker }, catalogRows: marker }, approval)
    expect(JSON.stringify(result)).not.toContain(marker)
    expect(Object.values(result).every(value => value === 'PASS' || value === 'BLOCKED')).toBe(true)
  })
})

describe('inert SQL plan and enablement requirements', () => {
  it('contains only fixed read-only transaction setup, metadata reads, and rollback', () => {
    expect(Object.isFrozen(diagnosticReadOnlyPlan)).toBe(true)
    expect(diagnosticReadOnlyPlan[0]).toBe('BEGIN READ ONLY')
    expect(diagnosticReadOnlyPlan.at(-1)).toBe('ROLLBACK')
    expect(diagnosticReadOnlyPlan).toContain("SET LOCAL statement_timeout = '5000ms'")
    expect(diagnosticReadOnlyPlan).toContain("SET LOCAL lock_timeout = '2000ms'")
    for (const statement of diagnosticReadOnlyPlan) {
      expect(statement).not.toMatch(/;|\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|COMMIT|CALL|COPY)\b/i)
    }
  })
  it('does not mistake database name and current role for authoritative server identity', () => {
    expect(diagnosticPathEvidence(evidence, { ...approval, serverIdentityAuthoritative: false }).identity).toBe('BLOCKED')
  })
  it('retains explicit authentication, transport, deployment and retirement gates', () => {
    expect(diagnosticEnablementRequirements).toContain('INDEPENDENT_ORIGIN_BOUND_OPERATOR_PROOF')
    expect(diagnosticEnablementRequirements).toContain('READ_ONLY_DASHBOARD_AUTHORIZATION')
    expect(diagnosticEnablementRequirements).toContain('AUTHORITATIVE_DIRECT_AND_POOLED_SERVER_IDENTITY')
    expect(diagnosticEnablementRequirements).toContain('SEPARATE_DEPLOYMENT_AND_INVOCATION_APPROVAL')
    expect(diagnosticEnablementRequirements).toContain('IMMUTABLE_DIAGNOSTIC_DEPLOYMENT_RETIREMENT_APPROVAL')
  })
})
