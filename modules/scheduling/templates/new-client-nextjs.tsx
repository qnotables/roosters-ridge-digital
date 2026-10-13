import { BookingEmbed } from '../ui/booking-embed'

export function ClientBookingPage({ businessName, tenantSlug }: { businessName: string; tenantSlug: string }) {
  return <main><header><h1>Schedule with {businessName}</h1><p>Choose a time using our secure booking service.</p></header><BookingEmbed tenantSlug={tenantSlug} /></main>
}
