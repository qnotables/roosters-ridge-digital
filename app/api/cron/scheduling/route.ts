import { timingSafeEqual } from 'node:crypto'
import { emailDb } from '@/lib/email-workspace-db'
import { processSchedulingNotifications } from '@/modules/scheduling/notification-worker'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function GET(request: Request) {
  const secret=process.env.CRON_SECRET
  const expected=Buffer.from(`Bearer ${secret??''}`), actual=Buffer.from(request.headers.get('authorization')??'')
  if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected)) return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}})
  try { return Response.json(await processSchedulingNotifications(emailDb),{headers:{'Cache-Control':'no-store'}}) }
  catch { return Response.json({error:'Scheduling processing unavailable; pending work remains retryable.'},{status:503,headers:{'Cache-Control':'no-store'}}) }
}
