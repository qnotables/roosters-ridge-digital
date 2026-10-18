import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  projects: vi.fn(),
  profile: vi.fn(),
}))
vi.mock('next/server', () => ({ connection: mocks.connection }))
vi.mock('@/lib/portfolio', async (original) => ({
  ...await original<typeof import('@/lib/portfolio')>(),
  getPublishedProjects: mocks.projects,
}))
vi.mock('@/lib/business-profile', () => ({ getBusinessProfile: mocks.profile }))
vi.mock('@/lib/db', () => ({ sql: null }))
vi.mock('@/components/forms/checkup-form', () => ({ CheckupForm: () => createElement('form', { 'aria-label': 'Checkup request' }) }))

import { servicePages } from '@/lib/service-pages'
import { ServicePageTemplate } from '@/components/service-page'
import { SelectedWork } from '@/components/home/selected-work'
import sitemap from '@/app/sitemap'
import WorkPage, { metadata as workMetadata } from '@/app/(site)/work/page'
import FreeCheckupPage, { metadata as checkupMetadata } from '@/app/(site)/free-checkup/page'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.connection.mockResolvedValue(undefined)
  mocks.projects.mockResolvedValue([])
  mocks.profile.mockResolvedValue({ response_time: 'Within two business days' })
})

describe('database-backed public pages render at request time', () => {
  for (const [name, page, query] of [
    ['work', WorkPage, mocks.projects],
    ['free-checkup', FreeCheckupPage, mocks.profile],
    ['home portfolio', SelectedWork, mocks.projects],
    ['service portfolio', () => ServicePageTemplate({ service: servicePages[0] }), mocks.projects],
    ['sitemap', sitemap, mocks.projects],
  ] as const) {
    it(`${name} waits for an incoming request before querying`, async () => {
      let release!: () => void
      mocks.connection.mockReturnValue(new Promise<void>((resolve) => { release = resolve }))
      const result = page()
      expect(mocks.connection).toHaveBeenCalledOnce()
      expect(query).not.toHaveBeenCalled()
      release()
      await result
      expect(query).toHaveBeenCalledOnce()
    })

    it(`${name} does not query if prerendering stops at the request boundary`, async () => {
      mocks.connection.mockRejectedValue(new Error('Prerender boundary'))
      await expect(page()).rejects.toThrow('Prerender boundary')
      expect(query).not.toHaveBeenCalled()
    })
  }

  it('keeps the portfolio empty state, navigation and SEO metadata', async () => {
    const html = renderToStaticMarkup(await WorkPage())
    expect(mocks.projects).toHaveBeenCalledWith('work')
    expect(html).toContain('Real Systems. Different Industries.')
    expect(html).toContain('Case studies are being prepared')
    expect(html).toContain('href="/industries"')
    expect(workMetadata.alternates?.canonical).toMatch(/\/work$/)
    expect(workMetadata.openGraph).toHaveProperty('images')
  })

  it('keeps request-time profile content, checkup form and SEO metadata', async () => {
    const html = renderToStaticMarkup(await FreeCheckupPage())
    expect(html).toContain('Within two business days')
    expect(html).toContain('aria-label="Checkup request"')
    expect(html).toContain('href="/book?source=checkup"')
    expect(checkupMetadata.alternates?.canonical).toMatch(/\/free-checkup$/)
    expect(checkupMetadata.robots).toEqual({ index: true, follow: true })
    expect(checkupMetadata.openGraph).toHaveProperty('images')
  })
})
