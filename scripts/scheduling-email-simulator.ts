import { Resend } from 'resend'
import { defaultPreferences, renderNotification, type NotificationEvent } from '../modules/scheduling/notifications'

async function main() {
  const runId = process.argv[2]
  if (process.argv[3] !== '--approved-simulator-send' || !runId || !/^[a-z0-9-]{1,80}$/.test(runId)) {
    throw new Error('Supply a stable rehearsal ID and explicit --approved-simulator-send authorization.')
  }
  if (!process.env.RESEND_API_KEY) throw new Error('Resend integration is required.')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const domains = await resend.domains.list()
  if (domains.error) throw new Error(`Sender verification unavailable: ${domains.error.name}`)
  const domain = domains.data.data.find(item => item.name === 'roostersridgedigital.com')
  if (!domain || domain.status !== 'verified') throw new Error('The RRD sender domain must be verified.')
  const verified = await resend.domains.get(domain.id)
  if (verified.error || verified.data.capabilities.sending !== 'enabled' || verified.data.records.some(record => ['SPF', 'DKIM'].includes(record.record) && record.status !== 'verified')) {
    throw new Error('Sending authentication is not verified.')
  }
  const booking = {
    customerName: 'Synthetic scheduling readiness recipient',
    appointmentType: 'Synthetic Website Design Consultation',
    start: '2026-11-10T15:00:00.000Z',
    timeZone: 'America/New_York',
    reference: `SIMULATOR-${runId}`,
    businessName: 'Roosters Ridge Digital — synthetic test only',
  }
  const events: NotificationEvent[] = ['confirmed', 'cancelled', 'rescheduled', 'reminder']
  for (const event of events) {
    const rendered = renderNotification(defaultPreferences.templates[event], {
      ...booking,
      start: event === 'rescheduled' ? '2026-11-11T15:00:00.000Z' : booking.start,
    })
    const response = await resend.emails.send({
      from: 'RRD Scheduling Readiness <scheduling-test@roostersridgedigital.com>',
      to: ['delivered@resend.dev'],
      replyTo: 'scheduling-test@roostersridgedigital.com',
      subject: `[SIMULATOR ONLY] ${rendered.subject}`,
      text: `Synthetic readiness test. No real appointment or management token exists.\n\n${rendered.text}`,
    }, { idempotencyKey: `scheduling-simulator/${runId}/${event}` })
    console.log(JSON.stringify({ event, recipient: 'delivered@resend.dev', state: response.error ? 'rejected' : 'accepted', providerId: response.data?.id ?? null, error: response.error?.name ?? null }))
    if (response.error || !response.data?.id) throw new Error('Simulator send was not accepted; stop and inspect before retrying with the same run ID.')
    await new Promise(resolve => setTimeout(resolve, 1100))
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Simulator rehearsal failed.')
  process.exitCode = 1
})
