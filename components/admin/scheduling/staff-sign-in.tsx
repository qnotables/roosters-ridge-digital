'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { signInStaffWithPassword } from '@/lib/staff-password-sign-in'
import { confirmSchedulingStaffSession } from '@/app/admin/scheduling/staff-sign-in/actions'
import { schedulingStaffReturnPath, signInSchedulingStaff } from '@/modules/scheduling/staff-sign-in'

export function SchedulingStaffSignIn({ sessionUnavailable = false, recoveryAvailable = false }: { sessionUnavailable?: boolean; recoveryAvailable?: boolean }) {
  const router = useRouter()
  const pending = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const destination = await signInSchedulingStaff(email, password, signInStaffWithPassword, confirmSchedulingStaffSession)
      setPassword('')
      router.replace(destination)
      router.refresh()
    } catch (failure) {
      setPassword('')
      setError(failure instanceof Error ? failure.message : 'Staff sign-in failed. Please try again.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Individual staff access</CardTitle>
        <CardDescription>Sign in with an existing, email-verified Neon Auth account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {sessionUnavailable && <Alert><AlertTitle>Session check unavailable</AlertTitle><AlertDescription>Your current staff session could not be verified. Try signing in again.</AlertDescription></Alert>}
        {error && <Alert variant="destructive" id="staff-sign-in-error"><AlertTitle>Sign-in not completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <form onSubmit={submit} aria-busy={busy} aria-describedby={error ? 'staff-sign-in-error' : undefined} onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
        }}>
          <FieldGroup>
            <Field data-disabled={busy}>
              <FieldLabel htmlFor="scheduling-staff-email">Staff email</FieldLabel>
              <Input id="scheduling-staff-email" name="email" type="email" autoComplete="username" required maxLength={320} disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field data-disabled={busy}>
              <FieldLabel htmlFor="scheduling-staff-password">Staff password</FieldLabel>
              <Input id="scheduling-staff-password" name="password" type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>{busy ? 'Confirming staff session…' : 'Sign in to Scheduling'}</Button>
          </FieldGroup>
        </form>
        {recoveryAvailable && <Link href="/admin/scheduling/forgot-password" prefetch={false} className="text-sm underline underline-offset-4">Forgot Password?</Link>}
        <p className="text-sm text-muted-foreground">Signing in does not grant scheduling access. An existing owner or administrator membership is still required. If access is denied, contact your scheduling administrator.</p>
      </CardContent>
      <CardFooter>
        <Link href={schedulingStaffReturnPath} className="text-sm underline underline-offset-4">Back to Scheduling</Link>
      </CardFooter>
    </Card>
  )
}
