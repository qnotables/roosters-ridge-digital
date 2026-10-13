import { emailDb } from '@/lib/email-workspace-db'
import { customerBooking, customerSchemaReady } from '@/modules/scheduling/customer-postgres'
import { customerCookie, customerHeaders } from '@/modules/scheduling/customer-http'
import { assertBookingOrigin, publicError } from '@/modules/scheduling/public-http'
import { claimBookingConversion } from '@/modules/scheduling/marketing-postgres'
import { rrdBookingMarketingTargets } from '@/lib/scheduling-lead-handoff'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    assertBookingOrigin(request)
    if (!await customerSchemaReady()) return Response.json({ conversion: null }, { headers: customerHeaders })
    const booking = await customerBooking(emailDb, await customerCookie('view'), 'view')
    const conversion = await claimBookingConversion(emailDb, booking.tenantId, booking.id)
    return Response.json({ conversion, targets: conversion?.consent ? rrdBookingMarketingTargets : {} }, { headers: customerHeaders })
  } catch (error) { return publicError(error) }
}
