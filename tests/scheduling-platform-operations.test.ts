import { describe, it, expect, vi } from 'vitest'
import { auditedPlatformOperation } from '@/modules/scheduling/platform-operations'
import { SchedulingError } from '@/modules/scheduling/types'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { SQL } from 'drizzle-orm'
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
vi.mock('@/lib/email-workspace-provider', () => ({ emailProvider: () => { throw new Error('No live email in verification.') } }))
import { createPlatformService } from '@/modules/scheduling/platform-service'

const verified = async () => ({ userId: 'verified-operator', verified: true })

describe('platform operation failure audits', () => {
  it('retains success results without duplicating transactional success audits', async () => {
    const audit = vi.fn(), operation = vi.fn(async (version: number) => version + 1)
    const run = auditedPlatformOperation('account_lifecycle_change_attempted', operation, verified, audit)
    expect(await run(2)).toBe(3)
    expect(operation).toHaveBeenCalledExactlyOnceWith(2)
    expect(audit).not.toHaveBeenCalled()
  })

  it('audits verified authorization denials with no submitted values or error details', async () => {
    const audit = vi.fn(), error = new SchedulingError('forbidden', 'Private error detail')
    const run = auditedPlatformOperation('account_lifecycle_change_attempted', async (_secret: string) => { throw error }, verified, audit)
    await expect(run('Private submitted value')).rejects.toBe(error)
    expect(audit).toHaveBeenCalledExactlyOnceWith('verified-operator', 'account_lifecycle_change_attempted', { code: 'forbidden' }, 'denied')
    expect(JSON.stringify(audit.mock.calls)).not.toContain('Private')
  })

  it('records validation and optimistic-conflict failures only after rollback', async () => {
    for (const code of ['invalid', 'unavailable'] as const) {
      const order: string[] = [], error = new SchedulingError(code, 'Private detail')
      const audit = vi.fn(async () => { order.push('audit') })
      const run = auditedPlatformOperation('plan_entitlements_change_attempted', async () => {
        try { throw error } finally { order.push('rollback') }
      }, verified, audit)
      await expect(run()).rejects.toBe(error)
      expect(order).toEqual(['rollback', 'audit'])
      expect(audit).toHaveBeenCalledWith('verified-operator', 'plan_entitlements_change_attempted', { code }, 'failed')
    }
  })

  it('sanitizes unexpected failures and preserves the original failure if audit storage is unavailable', async () => {
    const error = new Error('Secret database detail'), audit = vi.fn(async () => { throw new Error('Secret audit detail') })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const run = auditedPlatformOperation('notification_retry_attempted', async () => { throw error }, verified, audit)
      await expect(run()).rejects.toBe(error)
      expect(audit).toHaveBeenCalledWith('verified-operator', 'notification_retry_attempted', { code: 'error' }, 'failed')
      expect(log).toHaveBeenCalledExactlyOnceWith('[scheduling] Platform failure audit storage unavailable.')
    } finally { log.mockRestore() }
  })

  it('writes denial audits through the real service boundary without starting a mutation transaction', async () => {
    const dialect = new PgDialect(), queries: ReturnType<PgDialect['sqlToQuery']>[] = []
    const transaction = vi.fn()
    const db = {
      execute: vi.fn(async (query: SQL) => {
        const statement = dialect.sqlToQuery(query)
        queries.push(statement)
        return { rows: statement.sql.includes('to_regclass') ? [{ ready: true }] : [] }
      }),
      transaction,
    } as unknown as NodePgDatabase
    const service = createPlatformService(db, verified)
    const attempts = [
      () => service.updateSettings({}, 1, 'Private confirmation'),
      () => service.updatePlan('starter', {}, 1, 'Private confirmation'),
      () => service.account('Private tenant', 'starter', 'active', 1, 'Private confirmation'),
      () => service.closure('Private tenant', 'Private confirmation'),
      () => service.support('Private tenant'),
      () => service.retry('Private tenant', 'Private job', 'Private confirmation'),
    ]
    for (const attempt of attempts) await expect(attempt()).rejects.toMatchObject({ code: 'forbidden' })
    const audits = queries.filter(query => query.sql.includes('INSERT INTO rrd_scheduling.platform_audit'))
    expect(audits).toHaveLength(6)
    expect(audits.map(query => query.params[2])).toEqual([
      'platform_settings_change_attempted', 'plan_entitlements_change_attempted', 'account_lifecycle_change_attempted',
      'account_closure_attempted', 'support_configuration_inspection_attempted', 'notification_retry_attempted',
    ])
    for (const audit of audits) expect(audit.params).toEqual([null, 'verified-operator', expect.any(String), '{"code":"forbidden"}', 'denied'])
    expect(JSON.stringify(audits)).not.toContain('Private')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('does not fabricate actors for anonymous, unverified or failed identity lookups', async () => {
    const audit = vi.fn(), error = new SchedulingError('forbidden', 'No access')
    for (const identity of [async () => null, async () => ({ userId: 'unverified', verified: false }), async () => ({ userId: '', verified: true }), async () => { throw error }]) {
      const run = auditedPlatformOperation('account_closure_attempted', async () => { throw error }, identity, audit)
      await expect(run()).rejects.toBe(error)
    }
    expect(audit).not.toHaveBeenCalled()
  })
})
