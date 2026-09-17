'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignInForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)

    try {
      const response = await fetch('/api/admin/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: String(data.get('key') || '') }),
      })
      if (!response.ok) throw new Error('Invalid key')
      router.push('/admin/profile')
      router.refresh()
    } catch {
      setError('That dashboard key is not valid. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div className="space-y-2"><Label htmlFor="key">Dashboard key</Label><Input id="key" name="key" type="password" autoComplete="current-password" required /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Checking key…' : 'Open dashboard'}</Button>
    </form>
  )
}
