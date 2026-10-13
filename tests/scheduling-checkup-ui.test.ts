import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadActionState } from '@/lib/leads'

const mocks = vi.hoisted(() => ({ state: { ok: false } as LeadActionState, action: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useActionState: () => [mocks.state, mocks.action, false],
}))
vi.mock('@/app/actions/leads', () => ({ submitCheckup: mocks.action }))
import { CheckupForm } from '@/components/forms/checkup-form'

beforeEach(() => { mocks.state = { ok: false }; vi.clearAllMocks() })
describe('optional consultation on the actual checkup success state', () => {
  it('offers a native checkup booking only after the request succeeds', () => {
    mocks.state = { ok: true, referenceNumber: 'RRD-SYNTHETIC' }
    const html = renderToStaticMarkup(createElement(CheckupForm))
    expect(html).toContain('Your request has been received.')
    expect(html).toContain('RRD-SYNTHETIC')
    expect(html).toContain('href="/book?source=checkup"')
    expect(html).toContain('Schedule a Consultation')
    expect(html).toContain('Booking is optional and does not submit another lead request.')
    expect(html).toContain('aria-labelledby="checkup-consultation-heading"')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('role="button"')
    expect(mocks.action).not.toHaveBeenCalled()
  })
  it('keeps the offer and saved reference visible if confirmation email is delayed', () => {
    mocks.state = { ok: true, referenceNumber: 'RRD-SYNTHETIC', emailWarning: true }
    const html = renderToStaticMarkup(createElement(CheckupForm))
    expect(html).toContain('there is no need to submit again')
    expect(html).toContain('RRD-SYNTHETIC')
    expect(html).toContain('href="/book?source=checkup"')
  })
  it('does not show a post-submission booking offer when storage or validation fails', () => {
    mocks.state = { ok: false, message: 'We could not save your request.' }
    const html = renderToStaticMarkup(createElement(CheckupForm))
    expect(html).toContain('<form')
    expect(html).toContain('We could not save your request.')
    expect(html).not.toContain('checkup-consultation-heading')
    expect(html).not.toContain('href="/book?source=checkup"')
  })
})
