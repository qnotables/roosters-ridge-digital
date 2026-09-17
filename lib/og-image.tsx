import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export type OgVariant =
  | 'home'
  | 'about'
  | 'services'
  | 'work'
  | 'promotions'
  | 'free-checkup'
  | 'quote'
  | 'privacy'

const variants: Record<OgVariant, { label?: string; lines: string[]; accentLast?: boolean; alt: string }> = {
  home: {
    label: 'DIGITAL SERVICES FOR SMALL BUSINESSES',
    lines: ['LOOK CREDIBLE.', 'REACH MORE PEOPLE.', 'TURN ATTENTION INTO ACTION.'],
    accentLast: true,
    alt: 'Rooster’s Ridge Digital founder beside the message Look credible, reach more people, turn attention into action.',
  },
  about: {
    label: 'ABOUT',
    lines: ['PRACTICAL DIGITAL HELP.', 'WITHOUT THE AGENCY RUNAROUND.'],
    alt: 'Rooster’s Ridge Digital founder beside the message Practical digital help, without the agency runaround.',
  },
  services: {
    label: 'SERVICES',
    lines: ['DIGITAL SERVICES BUILT', 'FOR SMALL BUSINESS.'],
    alt: 'Rooster’s Ridge Digital founder beside the message Digital services built for small business.',
  },
  work: {
    label: 'OUR WORK',
    lines: ['WORK THAT HELPS', 'BUSINESSES SHOW UP WELL.'],
    alt: 'Rooster’s Ridge Digital founder beside the message Work that helps businesses show up well.',
  },
  promotions: {
    label: 'PROMOTIONAL MATERIALS',
    lines: ['PROMO-READY DESIGNS', 'FOR EVERY PLATFORM.'],
    alt: 'Rooster’s Ridge Digital founder beside the message Promo-ready designs for every platform.',
  },
  'free-checkup': {
    label: 'FREE DIGITAL PRESENCE CHECKUP',
    lines: ['HOW DOES YOUR DIGITAL', 'PRESENCE MEASURE UP?'],
    alt: 'Rooster’s Ridge Digital founder beside the message How does your digital presence measure up?',
  },
  quote: {
    label: 'FREE PROJECT ESTIMATE',
    lines: ['LET’S SCOPE', 'YOUR PROJECT.'],
    alt: 'Rooster’s Ridge Digital founder beside the message Let’s scope your project.',
  },
  privacy: {
    label: 'DIGITAL SERVICES FOR SMALL BUSINESSES',
    lines: ['LOOK CREDIBLE.', 'REACH MORE PEOPLE.', 'TURN ATTENTION INTO ACTION.'],
    accentLast: true,
    alt: 'Rooster’s Ridge Digital founder beside the message Look credible, reach more people, turn attention into action.',
  },
}

async function assetDataUrl(path: string, mimeType: string) {
  const buffer = await readFile(join(process.cwd(), 'public', path))
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

async function fontData() {
  const buffer = await readFile(join(process.cwd(), 'node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf'))
  return buffer
}

export async function createOgImage(variant: OgVariant) {
  const content = variants[variant] ?? variants.home
  const [logo, founder, font] = await Promise.all([
    assetDataUrl('images/roosters-ridge-digital-logo.png', 'image/png'),
    assetDataUrl('images/roosters-ridge-digital-homepage-hero.png', 'image/png'),
    fontData(),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          background: '#101a2c',
          color: '#fff8e8',
          display: 'flex',
          height: '100%',
          width: '100%',
          fontFamily: 'Geist',
          padding: '64px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '58%', paddingRight: '48px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#05070b', display: 'flex', height: '167px', marginBottom: '42px', overflow: 'hidden', width: '460px' }}>
              <img src={logo} alt="Rooster’s Ridge Digital" style={{ height: '167px', width: '460px' }} />
            </div>
            {content.label && <div style={{ color: '#f06423', display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: '2px', marginBottom: '24px' }}>{content.label}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: content.lines.length === 3 ? 39 : 45, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-1px' }}>
              {content.lines.map((line, index) => <div key={line} style={{ color: content.accentLast && index === content.lines.length - 1 ? '#f06423' : '#fff8e8', display: 'flex' }}>{line}</div>)}
            </div>
          </div>
          <div style={{ color: '#fff8e8', display: 'flex', fontSize: 20, letterSpacing: '2px' }}>ROOSTERSRIDGEDIGITAL.COM</div>
        </div>
        <div style={{ display: 'flex', height: '100%', width: '42%', overflow: 'hidden', position: 'relative' }}>
          <img src={founder} alt="" width="504" height="502" style={{ height: '100%', width: '100%', objectFit: 'cover', objectPosition: '72% center' }} />
          <div style={{ background: '#101a2c', display: 'flex', height: '100%', left: 0, opacity: 0.18, position: 'absolute', top: 0, width: '100%' }} />
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' },
      fonts: [{ name: 'Geist', data: font, weight: 700, style: 'normal' }],
    },
  )
}

export function getOgAlt(variant: OgVariant) {
  return variants[variant]?.alt ?? variants.home.alt
}

export function ogImageUrl(origin: string, variant: OgVariant) {
  return `${origin}/og/${variant}`
}

export const ogVariants = variants
