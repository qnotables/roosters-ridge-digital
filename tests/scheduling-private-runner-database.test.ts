import { beforeEach, describe, expect, it, vi } from 'vitest'
const driver = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), connect: vi.fn(), end: vi.fn(), configurations: [] as Record<string, unknown>[] }))
vi.mock('pg', () => ({ Pool: class {
  constructor(config: Record<string, unknown>) { driver.configurations.push(config) }
  on = vi.fn()
  connect = driver.connect
  end = driver.end
} }))
import { inspectConnection, identityQuery } from '../modules/scheduling/activation/staging-preflight'
const url = 'postgresql://fixture:secret@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require'
beforeEach(() => {
  vi.clearAllMocks(); driver.configurations.length = 0
  driver.connect.mockResolvedValue({ query: driver.query, release: driver.release })
  driver.end.mockResolvedValue(undefined)
  driver.query.mockImplementation(async (sql: string) => sql === identityQuery ? { rows: [{ project_id: 'fixture' }] } : { rows: [] })
})
describe('shared database driver security, mocked pg only', () => {
  it('forces verified TLS and read-only startup/transaction with bounded timeouts', async () => {
    await inspectConnection(url)
    expect(driver.configurations[0]).toMatchObject({ ssl: { rejectUnauthorized: true }, options: '-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000', connectionTimeoutMillis: 8000, query_timeout: 8000, max: 1 })
    expect(driver.configurations[0].connectionString).not.toContain('sslmode')
    expect(driver.query.mock.calls.map(c => c[0])).toEqual(['BEGIN READ ONLY', identityQuery, 'ROLLBACK'])
    expect(driver.release).toHaveBeenCalledWith(true); expect(driver.end).toHaveBeenCalledOnce()
  })
  it('destroys the connection and pool when a transaction query fails', async () => {
    driver.query.mockRejectedValue(new Error('fixture failure'))
    await expect(inspectConnection(url)).rejects.toThrow()
    expect(driver.release).toHaveBeenCalledWith(true); expect(driver.end).toHaveBeenCalledOnce()
  })
  it('closes the pool on TLS connection failure, with no query', async () => {
    driver.connect.mockRejectedValue(new Error('certificate failure'))
    await expect(inspectConnection(url)).rejects.toThrow()
    expect(driver.query).not.toHaveBeenCalled(); expect(driver.end).toHaveBeenCalledOnce()
  })
  it('rejects missing identity rows and still tears down connections', async () => {
    driver.query.mockResolvedValue({ rows: [] })
    await expect(inspectConnection(url)).rejects.toThrow()
    expect(driver.query.mock.calls.map(c => c[0])).toContain('ROLLBACK')
    expect(driver.release).toHaveBeenCalledWith(true); expect(driver.end).toHaveBeenCalledOnce()
  })
})
