'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'

export default function AdminSignInPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const result = await authClient.signIn.email({ email: String(data.get('email')), password: String(data.get('password')) })
    if (result.error) setError('Sign in could not be completed. Check your details and try again.')
    else { router.push('/admin/profile'); router.refresh() }
    setBusy(false)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Admin access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to edit the site</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Use your Neon Auth email and password to manage the business profile.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </section>
    </main>
  )
}
