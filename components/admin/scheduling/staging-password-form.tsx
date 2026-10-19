'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field'
import { authClient } from '@/lib/auth-client'
import type { StagingPasswordPreflight } from '@/lib/auth'

type Counts = Omit<StagingPasswordPreflight, 'authenticated'> & {
  active: number
  current: number
  other: number
  verified: boolean
}

async function readPreflight<T>(mode: 'preflight' | 'sessions' | 'status'): Promise<T> {
  const response = await fetch(`/api/admin/staging-password?mode=${mode}`, {
    cache: 'no-store', credentials: 'same-origin', redirect: 'error',
  })
  if (!response.ok) throw new Error('Verification unavailable.')
  return response.json()
}

export function StagingPasswordForm({ initial }: { initial: StagingPasswordPreflight }) {
  const formRef = useRef<HTMLFormElement>(null)
  const inFlight = useRef(false)
  const passwordAttempted = useRef(false)
  const signOutAttempted = useRef(false)
  const [busy, setBusy] = useState(false)
  const [approved, setApproved] = useState(false)
  const [signOutConfirmed, setSignOutConfirmed] = useState(false)
  const [changed, setChanged] = useState(false)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [finished, setFinished] = useState(false)
  const [message, setMessage] = useState('Awaiting separate approval for the immutable deployment and source commit below. No account operation has run.')

  function matchesDeployment(value: Omit<StagingPasswordPreflight, 'authenticated'>) {
    return window.location.origin === initial.applicationOrigin
      && value.projectId === initial.projectId && value.branch === initial.branch
      && value.applicationOrigin === initial.applicationOrigin
      && value.authenticationBaseUrl === initial.authenticationBaseUrl
      && value.deploymentId === initial.deploymentId && value.deploymentUrl === initial.deploymentUrl
      && value.sourceCommit === initial.sourceCommit
      && Number.isFinite(Date.parse(value.checkedAt))
      && Math.abs(Date.now() - Date.parse(value.checkedAt)) < 30_000
  }

  async function freshIdentity() {
    const value = await readPreflight<StagingPasswordPreflight>('preflight')
    if (!value.authenticated || !matchesDeployment(value)) throw new Error('Preflight mismatch.')
  }

  async function sessionCounts() {
    const value = await readPreflight<Counts>('sessions')
    if (!matchesDeployment(value) || !Number.isInteger(value.active) || value.active < 0
      || !Number.isInteger(value.current) || value.current < 0
      || !Number.isInteger(value.other) || value.other < 0
      || value.current + value.other !== value.active) throw new Error('Unverified count.')
    setCounts(value)
    return value.verified === true && value.active === 1 && value.current === 1 && value.other === 0
  }

  function start() {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    return true
  }

  function stop() {
    inFlight.current = false
    setBusy(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!approved || passwordAttempted.current || finished || !start()) return
    let confirmedChange = false
    try {
      await freshIdentity()
      const form = new FormData(formRef.current!)
      const currentPassword = String(form.get('currentPassword') ?? '')
      const newPassword = String(form.get('newPassword') ?? '')
      const confirmation = String(form.get('confirmation') ?? '')
      if (!currentPassword || newPassword.length < 8 || newPassword.length > 128
        || newPassword !== confirmation || newPassword === currentPassword) {
        setMessage('Use a different new password of 8–128 characters and enter matching confirmation. Nothing was submitted.')
        return
      }
      // Once sent, even a transport error is ambiguous: never retry this mutation.
      passwordAttempted.current = true
      const { data, error } = await authClient.changePassword({
        currentPassword, newPassword, revokeOtherSessions: true,
        fetchOptions: { retry: 0 },
      })
      if (error || !data) {
        setMessage('Password change was not confirmed. Stop and do not retry; no automatic sign-out will occur.')
        return
      }
      confirmedChange = true
      setChanged(true)
      setMessage('Password change confirmed. Checking active session counts…')
      const verified = await sessionCounts()
      setMessage(verified
        ? 'Password changed. One current session and zero other active sessions verified. Sign-out requires a separate confirmation and click.'
        : 'Password changed, but session revocation is unverified. Do not repeat the password change. Sign-out remains locked.')
    } catch {
      setMessage(confirmedChange
        ? 'Password changed, but session revocation could not be verified. Do not repeat the password change. Sign-out remains locked.'
        : passwordAttempted.current
          ? 'Password change outcome is unknown. Stop; do not retry. No automatic sign-out will occur.'
          : 'Fresh identity or deployment verification failed. Nothing was submitted. Stop without signing out or reauthenticating automatically.')
    } finally {
      formRef.current?.reset()
      stop()
    }
  }

  async function verifySessions() {
    if (!changed || signOutAttempted.current || finished || !start()) return
    setCounts(null)
    setSignOutConfirmed(false)
    try {
      const verified = await sessionCounts()
      setMessage(verified ? 'One current session and zero other active sessions verified.' : 'Session revocation is unverified. Sign-out remains locked.')
    } catch {
      setMessage('Session verification unavailable. Do not repeat the password change. Sign-out remains locked.')
    } finally { stop() }
  }

  async function signOut() {
    if (!changed || !counts?.verified || !signOutConfirmed || signOutAttempted.current || finished || !start()) return
    try {
      await freshIdentity()
      if (!(await sessionCounts())) {
        setCounts(null)
        setSignOutConfirmed(false)
        setMessage('Active session counts changed. Sign-out was not submitted.')
        return
      }
      signOutAttempted.current = true
      const { data, error } = await authClient.signOut({ fetchOptions: { retry: 0 } })
      if (error || !data?.success) throw new Error('Sign-out unconfirmed.')
      const status = await readPreflight<{ authenticated: boolean }>('status')
      if (status.authenticated !== false) throw new Error('Signed-out state unconfirmed.')
      setFinished(true)
      setCounts(null)
      setMessage('Sign-out confirmed. The staging Auth session is unauthenticated. No sign-in was attempted.')
    } catch {
      setCounts(null)
      setSignOutConfirmed(false)
      setMessage(signOutAttempted.current
        ? 'Sign-out outcome or unauthenticated state could not be confirmed. Stop; do not retry or sign in automatically.'
        : 'Fresh verification failed. Sign-out was not submitted. Stop without reauthenticating automatically.')
    } finally { stop() }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-xl border p-5" aria-labelledby="deployment-title">
        <h2 id="deployment-title" className="text-lg font-medium">Verify before use</h2>
        <p className="text-sm text-muted-foreground">Obtain separate execution approval for this exact binding. A fresh lookup validates the session; your current password proves credential control.</p>
        <dl className="flex flex-col gap-3 text-sm">
          {[
            ['Project', initial.projectId], ['Branch', initial.branch],
            ['Application origin', initial.applicationOrigin], ['Auth endpoint', initial.authenticationBaseUrl],
            ['Immutable deployment ID', initial.deploymentId], ['Immutable deployment URL', initial.deploymentUrl],
            ['Source commit', initial.sourceCommit],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-all font-mono text-xs">{value}</dd>
            </div>
          ))}
        </dl>
        <Field orientation="horizontal" data-disabled={busy || passwordAttempted.current || finished}>
          <input id="execution-approved" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={approved}
            onChange={event => setApproved(event.target.checked)} disabled={busy || passwordAttempted.current || finished} />
          <FieldLabel htmlFor="execution-approved">I have separately approved this exact deployment ID, URL, and source commit for password change and revocation of other staging sessions.</FieldLabel>
        </Field>
      </section>

      <form ref={formRef} onSubmit={submit} onKeyDown={event => {
        if (event.key === 'Enter' && ((event.target as HTMLElement).tagName === 'INPUT' || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
      }}>
        <FieldSet disabled={busy || !approved || passwordAttempted.current || finished}>
          <FieldLegend>1. Change password and revoke other sessions</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">Current password</FieldLabel>
              <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
              <Input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
            </Field>
            <Button type="submit" disabled={busy || !approved || passwordAttempted.current || finished}>Change staging password once</Button>
          </FieldGroup>
        </FieldSet>
      </form>

      <section className="flex flex-col gap-4" aria-labelledby="sign-out-title">
        <h2 id="sign-out-title" className="text-lg font-medium">2. Verify sessions, then sign out</h2>
        {counts && <p className="text-sm">Active sessions: {counts.active}. Current: {counts.current}. Others: {counts.other}.</p>}
        <Button type="button" variant="outline" onClick={verifySessions} disabled={busy || !changed || signOutAttempted.current || finished}>Recheck session counts only</Button>
        <Field orientation="horizontal" data-disabled={busy || !counts?.verified || signOutAttempted.current || finished}>
          <input id="confirm-sign-out" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={signOutConfirmed}
            onChange={event => setSignOutConfirmed(event.target.checked)} disabled={busy || !counts?.verified || signOutAttempted.current || finished} />
          <FieldLabel htmlFor="confirm-sign-out">I explicitly confirm ending my remaining current staging Auth session.</FieldLabel>
        </Field>
        <Button type="button" variant="outline" onClick={signOut} disabled={busy || !changed || !counts?.verified || !signOutConfirmed || signOutAttempted.current || finished}>Sign out current staging session once</Button>
      </section>
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">{busy ? 'Working once; do not refresh or resubmit. ' : ''}{message}</p>
      <p className="text-xs text-muted-foreground">Passwords are cleared after each attempt and are never written to URLs, logs, analytics, or browser storage by this form. Scheduling membership and configuration remain unchanged.</p>
    </div>
  )
}
