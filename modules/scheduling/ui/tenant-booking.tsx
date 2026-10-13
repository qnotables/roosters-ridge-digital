import type { CSSProperties } from 'react'
import { BookingWizard } from './booking-wizard'
import type { PublicAppointment } from '../public-types'
import { colorForeground, type InstallationBrand } from '../installation'

export function TenantBooking({ slug, brand, appointments, preferredAppointment, preview = false }: { slug: string; brand: InstallationBrand; appointments: PublicAppointment[]; preferredAppointment?: string; preview?: boolean }) {
  const style = { '--primary': brand.primaryColor, '--primary-foreground': colorForeground(brand.primaryColor), '--secondary': brand.secondaryColor, '--secondary-foreground': colorForeground(brand.secondaryColor), '--radius': brand.buttonStyle === 'square' ? '0px' : '.625rem', fontFamily: brand.typography === 'serif' ? 'Georgia, serif' : 'var(--font-geist-sans), sans-serif' } as CSSProperties
  const contactHref = brand.contactEmail ? `mailto:${brand.contactEmail}` : brand.contactPhone ? `tel:${brand.contactPhone.replace(/[^+\d]/g, '')}` : '#booking-contact-information'
  const Root = preview ? 'section' : 'main'
  return <Root style={style} className="min-h-dvh bg-background text-foreground">
    {preview && <><p role="status" className="border-b bg-muted p-4 text-center text-sm">Configuration preview only. No bookings or availability requests are submitted.</p><ul className="mx-auto flex max-w-6xl flex-wrap gap-4 p-8">{appointments.map(appointment => <li key={appointment.key} className="rounded-md border p-4"><p className="font-medium">{appointment.name}</p><p className="text-sm text-muted-foreground">{appointment.durationMinutes} minutes · {appointment.description}</p></li>)}</ul></>}
    {brand.logoUrl && <div className="mx-auto max-w-6xl px-8 pt-8"><img src={brand.logoUrl} alt={`${brand.displayName} logo`} className="h-16 max-w-64 object-contain" referrerPolicy="no-referrer" /></div>}
    <BookingWizard apiPath={`/api/scheduling/public/${slug}`} tracking={false} catalog={preview ? { state: 'unavailable', message: `${appointments.length} public appointment options configured. Activate scheduling after installation checks pass.` } : { state: 'ready', appointments }} preferredAppointment={preferredAppointment} brand={{ name: brand.displayName, eyebrow: brand.displayName, heading: 'Make time for what matters.', description: brand.description, contactHref }} />
    <footer id="booking-contact-information" className="mx-auto flex max-w-6xl flex-wrap gap-4 px-8 pb-8 text-sm text-muted-foreground"><span>{brand.displayName}</span>{brand.contactEmail && <a href={`mailto:${brand.contactEmail}`} className="underline">{brand.contactEmail}</a>}{brand.contactPhone && <a href={`tel:${brand.contactPhone.replace(/[^+\d]/g, '')}`} className="underline">{brand.contactPhone}</a>}</footer>
  </Root>
}
