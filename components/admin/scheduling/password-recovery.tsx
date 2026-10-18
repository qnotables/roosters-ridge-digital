'use client'

import { useEffect, useState } from 'react'
import { ForgotPasswordForm, NeonAuthUIProvider, ResetPasswordForm } from '@neondatabase/auth/react/ui'
import { authClient } from '@/lib/auth-client'
import { schedulingStaffSignInPath } from '@/modules/scheduling/staff-sign-in'
import { leaveSchedulingRecovery, schedulingRecoveryOrigin } from '@/modules/scheduling/password-recovery'
import '@neondatabase/auth/ui/css'

export function SchedulingPasswordRecovery({ mode }: { mode: 'forgot' | 'reset' }) {
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => { setReady(window.location.origin === schedulingRecoveryOrigin) }, [])

  function leave() {
    leaveSchedulingRecovery(path => {
      window.history.replaceState(null, '', path)
      window.location.replace(path)
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Scheduling · Staging staff recovery</p>
        <h1 className="text-2xl font-semibold tracking-tight">{mode === 'forgot' ? 'Forgot your staff password?' : 'Reset your staff password'}</h1>
        <p className="text-sm text-muted-foreground">{mode === 'forgot' ? 'Request a recovery email for your existing staff account.' : 'Choose a new staff password using your recovery email link.'} Recovery does not grant dashboard or scheduling permissions.</p>
      </header>
      {notice && <p role="status">{notice}</p>}
      {ready ? (
        <NeonAuthUIProvider
          authClient={authClient}
          baseURL={schedulingRecoveryOrigin}
          basePath="/admin/scheduling"
          viewPaths={{ SIGN_IN: 'staff-sign-in', FORGOT_PASSWORD: 'forgot-password', RESET_PASSWORD: 'reset-password' }}
          navigate={leave}
          replace={leave}
          signUp={false}
          credentials={{ confirmPassword: true }}
          toast={({ variant }) => setNotice(variant === 'error' ? 'Recovery could not be completed. Try again or request a new recovery link.' : 'Recovery request completed. Check your email if you requested a link, or sign in with your updated password.')}
        >
          <div onKeyDown={event => {
            if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
          }}>
            {mode === 'forgot' ? <ForgotPasswordForm localization={{}} /> : <ResetPasswordForm localization={{}} />}
          </div>
        </NeonAuthUIProvider>
      ) : <p role="status">Recovery is available only on the approved staging Preview origin with JavaScript enabled.</p>}
      <a href={schedulingStaffSignInPath} referrerPolicy="no-referrer" className="text-sm underline underline-offset-4" onClick={event => { event.preventDefault(); leave() }}>Back to staff sign-in</a>
    </main>
  )
}
