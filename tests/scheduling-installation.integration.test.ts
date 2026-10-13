import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
vi.mock('@/lib/email-workspace-provider', () => ({ emailProvider: () => { throw new Error('Live email prohibited.') } }))
import { createInstallationService, approvedEmbeddingOrigins, domainChallenge } from '@/modules/scheduling/installation-postgres'
import { installationDefaults } from '@/modules/scheduling/installation'
import { createTenantManagement, createTenantScheduling } from '@/modules/scheduling/tenant-service'
import { hostedScheduling } from '@/modules/scheduling/hosted-postgres'
import { createCustomerBooking, customerBooking, changeCustomerBooking } from '@/modules/scheduling/customer-postgres'
import { customerNotificationDetails } from '@/modules/scheduling/customer-notifications'
import { publicMonthAvailability } from '@/modules/scheduling/public-service'
import { requestClientKey } from '@/modules/scheduling/security'

const originalProtectionSecret = process.env.ADMIN_DASHBOARD_KEY
const connection = process.env.SCHEDULING_MULTITENANT_TEST_DATABASE_URL
const pool = new Pool({ connectionString: connection, max: 8, connectionTimeoutMillis: 15000, options: '-c statement_timeout=20000 -c lock_timeout=10000' }), db = drizzle(pool)
const suffix = randomUUID(), platform = `synthetic-install-platform-${suffix}`, owner = `synthetic-install-owner-${suffix}`
const identity = (userId: string) => async () => ({ userId, verified: true })
const platformService = createInstallationService(db, identity(platform)), ownerService = createInstallationService(db, identity(owner))
const slugA = `synthetic-install-a-${suffix}`, slugB = `synthetic-install-b-${suffix}`, domainA = `synthetic-a-${suffix}.example.invalid`, domainB = `synthetic-b-${suffix}.example.invalid`
let a: string, b: string, linkA: string, linkB: string, hostA: string, rrdBefore: unknown
const date = (days: number, hour = 13) => { const now = new Date(); now.setUTCDate(now.getUTCDate() + days); now.setUTCHours(hour, 0, 0, 0); return now.toISOString() }
const customer = (days: number, hour = 13) => ({ start: date(days, hour), name: 'Synthetic installation customer', email: `${randomUUID()}@example.invalid`, phone: '+1 555 010 0000', website: '', intake: { businessName: 'Synthetic', reason: 'Isolated test', websiteUrl: '', notes: '', customerTimeZone: 'Asia/Tokyo' } })
const key = () => requestClientKey(randomUUID(), 'synthetic-installation-secret-32-characters')
const book = (tenant: string, link: string, input: unknown, requestKey = randomUUID()) => createCustomerBooking(tenant, link, input, requestKey, key(), db, undefined, 'BOOK')
const provision = (slug: string, requestKey = randomUUID()) => ({ name: 'Synthetic installation business', slug, timeZone: 'UTC', administratorUserId: owner, requestKey })
async function baseline() { return (await db.execute(sql`SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS tenants,(SELECT md5(coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.id)::text,'[]')) FROM rrd_scheduling.bookings b JOIN rrd_scheduling.tenants t ON t.id=b.tenant_id WHERE t.slug='roosters-ridge-digital') AS bookings FROM rrd_scheduling.tenants t WHERE t.slug='roosters-ridge-digital'`)).rows }

describe.skipIf(!connection)('Phase 4B isolated PostgreSQL installation', () => {
  beforeAll(async () => {
    if (!connection || new URL(connection).hostname !== 'ep-red-hat-aub2bx37.c-10.us-east-1.aws.neon.tech') throw new Error('Only the approved isolated Neon compute is allowed.')
    process.env.ADMIN_DASHBOARD_KEY = 'synthetic-installation-secret-32-characters'
    rrdBefore = await baseline()
    await db.execute(sql`INSERT INTO rrd_scheduling.platform_administrators(user_id,active) VALUES(${platform},true)`)
    a = await platformService.provision(provision(slugA)); b = await platformService.provision(provision(slugB))
    await db.execute(sql`DELETE FROM rrd_scheduling.platform_accounts WHERE tenant_id IN (${a},${b})`)
    const management = createTenantManagement(db, identity(owner))
    for (const [tenant, domain] of [[a, domainA], [b, domainB]]) {
      const challenge = domainChallenge(tenant, domain)
      await platformService.verifyDomain(tenant, domain, async () => [[challenge.value]])
      const host = await management.saveHost(tenant, { name: 'Synthetic booking host', userId: null, active: true, dailyLimit: 100 })
      if (tenant === a) hostA = host
      const scheduling = createTenantScheduling(db, identity(owner), tenant)
      await scheduling.configure({ kind: 'availability', hostId: host, timeZone: 'UTC', dailyLimit: 100, weekly: [1,2,3,4,5,6,7].map(weekday => ({ weekday, startMinute: 540, endMinute: 1020 })), exceptions: [] }, 1)
      await scheduling.configure({ kind: 'type', slug: 'consultation', name: 'Synthetic consultation', durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, minimumNoticeMinutes: 0, maximumHorizonDays: 30, slotIntervalMinutes: 30, meetingMode: 'online', active: true, details: { description: 'Isolated booking only', location: '', archived: false, intakeQuestions: [] } }, 2)
      await scheduling.configure({ kind: 'policies', policies: { approval: 'automatic', cancellationMinutes: 0, reschedulingMinutes: 0, allowMultiple: true, customerConfirmation: true, hostNotification: false, cancellationNotice: false, reminderMinutes: [] } }, 3)
      const configuration = installationDefaults('Synthetic installation business'); configuration.embeddingOrigins = [`https://${domain}`]; configuration.brand.contactEmail = `contact@${domain}`
      await ownerService.save(tenant, configuration)
      await platformService.activation(tenant, true)
    }
    linkA = (await hostedScheduling(slugA, db))!.context.appointments[0].key; linkB = (await hostedScheduling(slugB, db))!.context.appointments[0].key
  }, 60000)
  afterAll(async () => {
    try {
      for (const tenant of [a, b].filter(Boolean)) { await db.execute(sql`UPDATE rrd_scheduling.tenants SET enabled=false WHERE id=${tenant}`); await db.execute(sql`UPDATE rrd_scheduling.notification_settings SET delivery_enabled=false WHERE tenant_id=${tenant}`) }
      await db.execute(sql`UPDATE rrd_scheduling.platform_administrators SET active=false WHERE user_id=${platform}`)
      if (process.env.SCHEDULING_BROWSER_FIXTURE === 'true' && a) { await db.execute(sql`UPDATE rrd_scheduling.tenants SET enabled=true WHERE id=${a}`); console.info(`ISOLATED_BROWSER_TENANT=${slugA}`) }
    } finally { if (originalProtectionSecret === undefined) delete process.env.ADMIN_DASHBOARD_KEY; else process.env.ADMIN_DASHBOARD_KEY = originalProtectionSecret; await pool.end() }
  })
  it('atomically provisions once under simultaneous retries', async () => {
    const command = provision(`synthetic-retry-${suffix}`), results = await Promise.all([platformService.provision(command), platformService.provision(command)])
    expect(results[0]).toBe(results[1]); const result = await platformService.inspect(results[0], true); expect(result.tenant.enabled).toBe(false); expect(result.notifications.deliveryEnabled).toBe(false)
    const admins = await db.execute(sql`SELECT count(*)::integer AS count FROM rrd_scheduling.members WHERE tenant_id=${results[0]} AND permission_role='tenant_admin'`); expect(admins.rows[0].count).toBe(1)
  })
  it('rejects duplicate slugs with different request payloads', async () => { const command = provision(`synthetic-duplicate-${suffix}`); await platformService.provision(command); await expect(platformService.provision({ ...command, name: 'Another business' })).rejects.toMatchObject({ code: 'invalid' }) })
  it('rejects unauthorized and unverified provisioning', async () => { await expect(ownerService.provision(provision(`synthetic-denied-${suffix}`))).rejects.toMatchObject({ code: 'forbidden' }); await expect(createInstallationService(db, async () => ({ userId: platform, verified: false })).provision(provision(`synthetic-unverified-${suffix}`))).rejects.toMatchObject({ code: 'forbidden' }) })
  it('resolves hosted pages only for active tenants with public types', async () => { expect((await hostedScheduling(slugA, db))?.tenant.id).toBe(a); await platformService.activation(b, false); expect(await hostedScheduling(slugB, db)).toBeNull(); await platformService.activation(b, true) })
  it('does not accept another tenant public appointment key', async () => { await expect(book(a, linkB, customer(2))).rejects.toMatchObject({ code: 'unavailable' }) })
  it('requires tenant-bound DNS ownership and prevents domain theft', async () => { await expect(platformService.verifyDomain(b, domainA, async () => [[domainChallenge(a, domainA).value]])).rejects.toMatchObject({ code: 'invalid' }); await expect(platformService.verifyDomain(b, domainA, async () => [[domainChallenge(b, domainA).value]])).rejects.toMatchObject({ code: 'forbidden' }); await expect(ownerService.verifyDomain(a, domainA, async () => [[domainChallenge(a, domainA).value]])).rejects.toMatchObject({ code: 'forbidden' }) })
  it('does not allow activation before prerequisites or tenant-admin activation', async () => { const id = await platformService.provision(provision(`synthetic-not-ready-${suffix}`)); await expect(platformService.activation(id, true)).rejects.toMatchObject({ code: 'invalid' }); await expect(ownerService.activation(a, false)).rejects.toMatchObject({ code: 'forbidden' }) })
  it('refuses activation when runtime abuse protection is not configured', async () => { const secret = process.env.ADMIN_DASHBOARD_KEY; process.env.ADMIN_DASHBOARD_KEY = ''; try { await expect(platformService.activation(a, true)).rejects.toMatchObject({ code: 'unavailable' }) } finally { process.env.ADMIN_DASHBOARD_KEY = secret } })
  it('isolates installation reads and mutations', async () => { const outsider = createInstallationService(db, identity('synthetic-outsider')); await expect(outsider.inspect(a)).rejects.toMatchObject({ code: 'forbidden' }); await expect(outsider.save(a, installationDefaults('Other'))).rejects.toMatchObject({ code: 'forbidden' }) })
  it('allows only verified tenant-owned embedding origins and rechecks revocation', async () => { const config = installationDefaults('Synthetic'); config.embeddingOrigins = [`https://${domainB}`]; await expect(ownerService.save(a, config)).rejects.toMatchObject({ code: 'forbidden' }); const stored = await ownerService.inspect(a); expect(await approvedEmbeddingOrigins(db, a, { installation: stored.configuration }, stored.tenant.name)).toEqual([`https://${domainA}`]); await db.execute(sql`UPDATE rrd_scheduling.domains SET active=false WHERE tenant_id=${a} AND hostname=${domainA}`); expect(await approvedEmbeddingOrigins(db, a, { installation: stored.configuration }, stored.tenant.name)).toEqual([]); await db.execute(sql`UPDATE rrd_scheduling.domains SET active=true WHERE tenant_id=${a} AND hostname=${domainA}`) })
  it('preserves retry metadata and installation settings through legacy branding edits', async () => { const data = await ownerService.inspect(a); await createTenantManagement(db, identity(owner)).configure(a, { name: data.tenant.name, slug: slugA, timeZone: 'UTC', enabled: true, primaryDomain: domainA, branding: { accentColor: '#315c48' } }); expect((await ownerService.inspect(a)).configuration).toEqual(data.configuration) })
  it('deduplicates real simultaneous booking submissions and rejects changed payloads', async () => { const input = customer(3), requestKey = randomUUID(); const result = await Promise.all([book(a, linkA, input, requestKey), book(a, linkA, input, requestKey)]); expect(result[0]).toEqual(result[1]); expect(result[0].reference).toMatch(/^BOOK-/); await expect(book(a, linkA, { ...input, name: 'Changed' }, requestKey)).rejects.toMatchObject({ code: 'invalid' }) })
  it('permits only one booking in a real conflicting-slot race', async () => { const results = await Promise.allSettled([book(a, linkA, customer(4)), book(a, linkA, customer(4))]); expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'unavailable' } }) }, 30000)
  it('allows independent tenant bookings at identical times', async () => { const results = await Promise.all([book(a, linkA, customer(5)), book(b, linkB, customer(5))]); expect(results).toHaveLength(2) })
  it('rejects a capability on another tenant and retains RRD-only legacy binding', async () => { const result = await book(a, linkA, customer(6)); expect((await customerBooking(db, result.tokens.view!, 'view', a)).reference).toBe(result.reference); await expect(customerBooking(db, result.tokens.view!, 'view', b)).rejects.toMatchObject({ code: 'forbidden' }); await expect(customerBooking(db, result.tokens.view!, 'view')).rejects.toMatchObject({ code: 'forbidden' }) })
  it('serializes secure cancellation and rotates rescheduling capabilities', async () => { const result = await book(a, linkA, customer(7)); const changed = await changeCustomerBooking(result.tokens.reschedule!, 'reschedule', date(8), db, a); await expect(customerBooking(db, result.tokens.cancel!, 'cancel', a)).rejects.toMatchObject({ code: 'forbidden' }); const race = await Promise.allSettled([changeCustomerBooking(changed.tokens.cancel!, 'cancel', undefined, db, a), changeCustomerBooking(changed.tokens.cancel!, 'cancel', undefined, db, a)]); expect(race.filter(r => r.status === 'fulfilled')).toHaveLength(1) }, 30000)
  it('groups availability in customer time zones without changing business inventory', async () => { const data = (await hostedScheduling(slugA, db))!, month = date(10).slice(0,7); const availability = await publicMonthAvailability(data.context.engine, data.context.appointments[0], month, 'Asia/Tokyo'); expect(availability.timeZone).toBe('Asia/Tokyo'); const starts = Object.values(availability.days).flat(); expect(starts.length).toBeGreaterThan(0); expect(starts.every(s => Number.isFinite(Date.parse(s.start)))).toBe(true) }, 30000)
  it('routes management notifications to this business without RRD branding or tenant leakage', async () => { const result = await book(a, linkA, customer(9)), record = await customerBooking(db, result.tokens.view!, 'view', a); const detail = await customerNotificationDetails(db, 'confirmed', { version: record.version, start_time: record.start, duration_minutes: 30 }, a, hostA, record.id); expect(detail).toContain(`/book/${slugA}/manage#`); expect(detail).not.toContain(slugB); expect(detail).not.toContain('Roosters Ridge Digital'); expect((await ownerService.inspect(a)).notifications.deliveryEnabled).toBe(false) })
  it('accepts only tenant-approved sender domains and keeps delivery disabled', async () => { const settings = (await ownerService.inspect(a)).notifications; const scheduling = createTenantScheduling(db, identity(owner), a); await expect(scheduling.saveNotifications({ ...settings, senderAddress: `sender@${domainB}` })).rejects.toMatchObject({ code: 'forbidden' }); await scheduling.saveNotifications({ ...settings, senderAddress: `sender@${domainA}`, replyTo: `contact@${domainA}`, adminRecipients: [`admin@${domainA}`] }); const saved = (await ownerService.inspect(a)).notifications; expect(saved.deliveryEnabled).toBe(false); expect(saved.adminRecipients).toEqual([`admin@${domainA}`]) })
  it('provides actionable configuration diagnostics without infrastructure secrets', async () => { const checks = await ownerService.diagnostics(a); expect(checks.find(c => c.key === 'public')?.ok).toBe(true); expect(JSON.stringify(checks)).not.toMatch(/postgres:|password|DATABASE_URL/) })
  it('preserves the existing RRD baseline', async () => { expect(await baseline()).toEqual(rrdBefore) })
})
