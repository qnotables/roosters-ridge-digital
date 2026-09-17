import type { OgVariant } from '@/lib/og-image'
import { getOgAlt, ogImageUrl } from '@/lib/og-image'

export const ogImageSize = {
  width: 1200,
  height: 630,
  type: 'image/png',
} as const

export function ogMetadata(variant: OgVariant) {
  const url = ogImageUrl('https://roostersridgedigital.com', variant)
  return {
    url,
    ...ogImageSize,
    alt: getOgAlt(variant),
  }
}

export function twitterImage(variant: OgVariant) {
  return ogImageUrl('https://roostersridgedigital.com', variant)
}
