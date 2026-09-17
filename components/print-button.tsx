'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'

export function PrintButton() {
  return (
    <Button
      size="sm"
      onClick={() => {
        trackEvent('promo_resource_printed', { resource: 'services-overview' })
        window.print()
      }}
    >
      <Printer data-icon="inline-start" />
      Print / Save PDF
    </Button>
  )
}
