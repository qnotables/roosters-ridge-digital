import { emailDb } from '@/lib/email-workspace-db'
import { siteConfig } from '@/lib/site-config'
import { customerBooking, customerSchemaReady } from '@/modules/scheduling/customer-postgres'
import { customerCookie, customerHeaders } from '@/modules/scheduling/customer-http'
import { customerCalendar } from '@/modules/scheduling/customer-calendar'
import { publicError } from '@/modules/scheduling/public-http'
import { SchedulingError } from '@/modules/scheduling/types'
export const runtime = 'nodejs'
export async function GET() {
  try {
    if (!await customerSchemaReady()) throw new SchedulingError('unavailable','Appointment management is not configured yet.')
    const booking = await customerBooking(emailDb,await customerCookie('view'),'view')
    return new Response(customerCalendar(booking,siteConfig.contact.email),{ headers:{ ...customerHeaders,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="roosters-ridge-appointment.ics"' } })
  } catch (error) { return publicError(error) }
}
