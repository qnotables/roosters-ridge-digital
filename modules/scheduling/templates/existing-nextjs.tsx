import { BookingEmbed } from '../ui/booking-embed'

export function ExistingWebsiteScheduling({ tenantSlug, appointment }: { tenantSlug: string; appointment?: string }) {
  return <section aria-labelledby="website-booking-heading"><h2 id="website-booking-heading">Schedule an appointment</h2><BookingEmbed tenantSlug={tenantSlug} appointment={appointment} /></section>
}
