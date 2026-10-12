import type { CustomerAppointment } from './customer-types'

const escapeText = (value: string) => value.replaceAll('\\','\\\\').replace(/\r\n|\r|\n/g,'\\n').replaceAll(';','\\;').replaceAll(',','\\,')
const timestamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')
function fold(line: string) {
  const chunks: string[] = []
  let chunk = '', bytes = 0
  for (const character of line) {
    const length = Buffer.byteLength(character)
    if (bytes+length > 75) { chunks.push(chunk); chunk = ' '; bytes = 1 }
    chunk += character; bytes += length
  }
  chunks.push(chunk)
  return chunks.join('\r\n')
}
export function customerCalendar(b: CustomerAppointment, contact: string) {
  const cancelled = b.status === 'cancelled'
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Roosters Ridge Digital//Native Scheduling//EN','CALSCALE:GREGORIAN',`METHOD:${cancelled ? 'CANCEL' : 'PUBLISH'}`,'BEGIN:VEVENT',`ORGANIZER;CN=Roosters Ridge Digital:mailto:${contact.replace(/[\r\n]/g,'')}`,`UID:${b.id}@roostersridgedigital.com`,`SEQUENCE:${b.version}`,`DTSTAMP:${timestamp(b.updatedAt)}`,`LAST-MODIFIED:${timestamp(b.updatedAt)}`,`DTSTART:${timestamp(b.start)}`,`DTEND:${timestamp(b.end)}`,`SUMMARY:${escapeText(b.appointmentType)}`,`DESCRIPTION:${escapeText(`${b.location}\nTime zone: ${b.timeZone}\nContact: ${contact}`)}`,`LOCATION:${escapeText(b.location)}`,`STATUS:${cancelled ? 'CANCELLED' : b.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED'}`,'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n'
}
