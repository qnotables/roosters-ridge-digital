import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { installationDefaults, validateInstallation, embeddingOrigin, frameAncestors, publicInstallation, iframeCode, colorForeground, generatedTenantSlug } from '@/modules/scheduling/installation'
import { BookingEmbed } from '@/modules/scheduling/ui/booking-embed'
import { domainChallenge } from '@/modules/scheduling/installation-postgres'
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))

describe('Phase 4B installation boundaries', () => {
  it('projects only public branding, not provisioning metadata', () => {
    const configuration = installationDefaults('Synthetic Business')
    const result = publicInstallation({ _provisioning: 'private-hash', installation: configuration, secret: 'not-public' }, 'Fallback')
    expect(result).toEqual(configuration); expect(JSON.stringify(result)).not.toContain('private-hash')
  })
  it('uses disabled-safe branding defaults for missing or invalid configuration', () => {
    expect(publicInstallation({ installation: { brand: { logoUrl: 'javascript:alert(1)' } } }, 'Business')).toEqual(installationDefaults('Business'))
  })
  it.each(['http://example.com', 'https://example.com:8443', 'https://example.com/path', 'https://example.com?x=1', 'https://user:password@example.com', '*', "https://example.com; frame-ancestors *", 'https://localhost', 'https://127.0.0.1'])('rejects unsafe embedding origin %s', input => { expect(() => embeddingOrigin(input)).toThrow() })
  it('normalizes HTTPS origins and deduplicates without wildcards', () => {
    const config = installationDefaults('Business'); config.embeddingOrigins = ['https://EXAMPLE.com/', 'https://example.com']
    expect(validateInstallation(config).embeddingOrigins).toEqual(['https://example.com'])
    expect(frameAncestors(['https://example.com'])).toBe("frame-ancestors 'self' https://example.com; object-src 'none'; base-uri 'self'")
    expect(frameAncestors([])).not.toContain('*')
  })
  it.each([{ logoUrl: 'http://example.com/logo.png' }, { primaryColor: 'red; color:black' }, { typography: 'custom-script' }, { buttonStyle: 'javascript' }, { contactEmail: 'invalid' }, { description: '<script>bad</script>' }])('rejects invalid branding %j', patch => {
    const configuration = installationDefaults('Business'); Object.assign(configuration.brand, patch); expect(() => validateInstallation(configuration)).toThrow()
  })
  it('uses accessible black or white button labels', () => { expect(colorForeground('#ffffff')).toBe('#000000'); expect(colorForeground('#000000')).toBe('#ffffff') })
  it('generates stable unique slugs for retry keys', () => { expect(generatedTenantSlug('A Business!', 'abcd1234')).toBe('a-business-abcd1234') })
  it('installation codes contain only public HTTPS URLs', () => { const code = iframeCode('synthetic-business'); expect(code).toContain('https://roostersridgedigital.com/embed/synthetic-business'); expect(code).not.toMatch(/DATABASE|AUTH|TOKEN|secret/i); expect(() => iframeCode('other/tenant')).toThrow() })
  it('renders a portable React integration with a hosted fallback', () => { const html = renderToStaticMarkup(createElement(BookingEmbed, { tenantSlug: 'synthetic-business', appointment: 'consultation' })); expect(html).toContain('/embed/synthetic-business/consultation'); expect(html).toContain('title="Schedule an appointment"'); expect(html).toContain('referrerPolicy="no-referrer"'); expect(html).toContain('/book/synthetic-business/consultation') })
  it('native integration rejects tenant selector injection', () => { expect(renderToStaticMarkup(createElement(BookingEmbed, { tenantSlug: '../other-business' }))).not.toContain('<iframe') })
  it('binds DNS ownership proofs to tenant and exact hostname', () => {
    vi.stubEnv('ADMIN_DASHBOARD_KEY', 'synthetic-domain-proof-secret-32-characters')
    const a = domainChallenge('tenant-a', 'example.com')
    expect(a.value).not.toBe(domainChallenge('tenant-b', 'example.com').value)
    expect(a.value).not.toBe(domainChallenge('tenant-a', 'www.example.com').value)
    expect(a.name).toBe('_rrd-booking.example.com'); expect(a.value).toMatch(/^rrd-booking=[a-f0-9]{64}$/)
    vi.unstubAllEnvs()
  })
})
