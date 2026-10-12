'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { siteConfig } from '@/lib/site-config'

export function CustomerLinkExchange() {
  const router = useRouter(), capability = useRef<{ purpose:string;token:string } | null>(null)
  const [ready,setReady] = useState(false), [pending,setPending] = useState(false), [error,setError] = useState('')
  useEffect(() => {
    if (capability.current) return
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const purpose = fragment.get('purpose'), token = fragment.get('token')
    window.history.replaceState(null,'',window.location.pathname)
    if (purpose && token && ['view','cancel','reschedule'].includes(purpose) && /^[A-Za-z0-9_-]{43}$/.test(token)) { capability.current = { purpose,token }; setReady(true) }
    else setError('This link is incomplete. Please open the original link in your appointment email.')
  },[])
  async function open() {
    if (!capability.current || pending) return
    setPending(true);setError('')
    try {
      const response = await fetch('/api/booking/manage',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ action:'exchange',...capability.current }) })
      const data = await response.json()
      if (!response.ok) { setError(data.message ?? 'This link is invalid or expired.'); return }
      capability.current = null
      router.replace('/book/confirmed');router.refresh()
    } catch { setError('We could not open your appointment. Please try again.') }
    finally { setPending(false) }
  }
  return <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 py-16"><p className="text-sm text-muted-foreground">Roosters Ridge Digital · Private appointment access</p><Card><CardHeader><CardTitle>Manage your appointment</CardTitle><CardDescription>View your details before making a change. Opening a link never cancels or reschedules an appointment.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5">{error && <p role="alert">{error}</p>}<Button disabled={!ready || pending} onClick={() => void open()}>{pending ? 'Opening…' : 'Open my appointment'}</Button><a className="text-sm underline" href={`mailto:${siteConfig.contact.email}`}>Contact our team for help</a></CardContent></Card></div>
}
