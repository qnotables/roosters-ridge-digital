import { describe, expect, it } from 'vitest'
import { assertIsolatedConnection, isolatedHost, isolatedTestEnvironment } from '@/modules/scheduling/activation/isolated-target.mjs'

const url = (host = isolatedHost) => `postgresql://synthetic:synthetic@${host}/neondb?sslmode=require`
describe('exact disposable database execution boundary', () => {
  it('accepts only the reviewed direct endpoint', () => {
    expect(new URL(assertIsolatedConnection(url())).hostname).toBe(isolatedHost)
    for (const host of ['ep-divine-scene-au7rxgk5.c-10.us-east-1.aws.neon.tech', 'ep-divine-scene-au7rxgk5-pooler.c-10.us-east-1.aws.neon.tech', isolatedHost.replace('.c-10', '-pooler.c-10'), 'localhost', `${isolatedHost}.evil.invalid`]) expect(() => assertIsolatedConnection(url(host))).toThrow()
  })
  it('rejects missing URLs, routing overrides, wrong databases and non-TLS connections', () => {
    for (const value of [undefined, '', 'invalid', url().replace('/neondb', '/other'), url().replace('require', 'disable'), `${url()}&options=endpoint%3Dep-divine-scene-au7rxgk5`, `${url()}&host=localhost`, `${url()}#other`]) expect(() => assertIsolatedConnection(value)).toThrow()
  })
  it('strips production aliases and all live provider credentials from the test process', () => {
    const source = { PATH: '/synthetic/bin', DATABASE_URL: url('production.invalid'), PGHOST: 'production.invalid', PGPASSWORD: 'private', RESEND_API_KEY: 'private', STRIPE_SECRET_KEY: 'private', ADMIN_DASHBOARD_KEY: 'private', NEON_AUTH_BASE_URL: 'https://production.invalid', NODE_OPTIONS: '--require unsafe' }
    const env = isolatedTestEnvironment(url(), source)
    expect(env.PATH).toBe(source.PATH)
    for (const key of Object.keys(source).filter(key => key !== 'PATH')) expect(env).not.toHaveProperty(key)
    for (const name of ['SCHEDULING_TEST_DATABASE_URL', 'SCHEDULING_MULTITENANT_TEST_DATABASE_URL', 'SCHEDULING_BILLING_TEST_DATABASE_URL']) expect(new URL(env[name]).hostname).toBe(isolatedHost)
    expect(() => isolatedTestEnvironment(source.DATABASE_URL, source)).toThrow()
  })
})
