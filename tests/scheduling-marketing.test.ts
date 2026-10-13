import { afterEach, describe, expect, it, vi } from 'vitest'
const track=vi.hoisted(()=>vi.fn())
vi.mock('@vercel/analytics',()=>({track}))
import { emitBookingConversion, trackBookingEvent } from '@/modules/scheduling/marketing'
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()})
describe('privacy conscious booking attribution',()=>{
  it('never forwards customer details with first-party events',()=>{trackBookingEvent('booking_completed');expect(track).toHaveBeenCalledWith('booking_completed')})
  it('does not load or contact advertising platforms without consent',()=>{emitBookingConversion('c628b366-6b90-4d57-9189-891b100ab22b',false,{google:'AW-123/test',metaPixelId:'123456789'});expect(track).not.toHaveBeenCalled()})
  it('sends only a deduplication id and configured conversion target',()=>{
    const gtag=vi.fn(),fbq=vi.fn();vi.stubGlobal('window',{gtag,fbq})
    const id='c628b366-6b90-4d57-9189-891b100ab22b'
    emitBookingConversion(id,true,{google:'AW-123/test',metaPixelId:'123456789'})
    expect(gtag).toHaveBeenCalledExactlyOnceWith('event','conversion',{send_to:'AW-123/test',transaction_id:id})
    expect(fbq).toHaveBeenCalledExactlyOnceWith('trackCustom','BookingCompleted',{}, {eventID:id})
  })
  it('rejects invalid receipt ids and malformed conversion targets',()=>{
    const gtag=vi.fn(),fbq=vi.fn();vi.stubGlobal('window',{gtag,fbq})
    emitBookingConversion('customer@example.com',true,{google:'AW-123/test',metaPixelId:'123456789'})
    emitBookingConversion('c628b366-6b90-4d57-9189-891b100ab22b',true,{google:'javascript:alert(1)',metaPixelId:'not-an-id'})
    expect(gtag).not.toHaveBeenCalled();expect(fbq).not.toHaveBeenCalled()
  })
})
