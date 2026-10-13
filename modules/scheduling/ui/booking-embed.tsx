'use client'
import { useState } from 'react'

const origin = 'https://roostersridgedigital.com'
export function BookingEmbed({ tenantSlug, appointment, title = 'Schedule an appointment' }: { tenantSlug: string; appointment?: string; title?: string }) {
  const [loaded, setLoaded] = useState(false)
  const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(tenantSlug) && tenantSlug.length <= 100 && (!appointment || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(appointment) && appointment.length <= 100)
  if (!valid) return <p role="alert">The booking installation is not configured correctly.</p>
  const suffix = appointment ? `/${appointment}` : '', hosted = `${origin}/book/${tenantSlug}${suffix}`
  return <section aria-label={title} style={{ width: '100%' }}>
    {!loaded && <p role="status">Loading booking options…</p>}
    <iframe src={`${origin}/embed/${tenantSlug}${suffix}`} title={title} width="100%" height="1000" style={{ border: 0, display: 'block' }} referrerPolicy="no-referrer" loading="lazy" onLoad={() => setLoaded(true)} />
    <p><a href={hosted} target="_blank" rel="noopener noreferrer">Open booking in a new tab</a> if the widget does not load.</p>
  </section>
}
