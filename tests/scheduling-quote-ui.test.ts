import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ handoff: vi.fn() }))
vi.mock('@/lib/scheduling-lead-handoff', () => ({ readLeadHandoff: mocks.handoff }))
import ThankYouPage from '@/app/(site)/thank-you/page'
beforeEach(() => { vi.clearAllMocks(); mocks.handoff.mockResolvedValue(null) })
describe('optional consultation after website quote submission', () => {
  it('retains quote appointment selection even if the optional cookie could not be saved', async () => {
    const html = renderToStaticMarkup(await ThankYouPage({ searchParams: Promise.resolve({ type: 'quote', ref: 'RRD-SYNTHETIC' }) }))
    expect(html).toContain('Talk through your website project')
    expect(html).toContain('href="/book?source=quote"')
    expect(html).toContain('Booking a free consultation is optional and does not submit another lead request.')
    expect(html).toContain('RRD-SYNTHETIC')
    expect(html).not.toContain('<form')
  })
  it('offers consultation when email is delayed without telling customers to resubmit', async () => {
    mocks.handoff.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', type: 'quote' })
    const html = renderToStaticMarkup(await ThankYouPage({ searchParams: Promise.resolve({ type: 'quote', emailWarning: '1' }) }))
    expect(html).toContain('Your request was saved successfully')
    expect(html).toContain('href="/book?source=quote"')
    expect(html).not.toContain('11111111-1111-4111-8111-111111111111')
    expect(html).toContain('Prefer not to book?')
  })
  it('keeps generic consultation navigation for unrelated thank-you visits', async () => {
    const html = renderToStaticMarkup(await ThankYouPage({ searchParams: Promise.resolve({ type: 'other' }) }))
    expect(html).toContain('href="/book"')
  })
})
