import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { getStagingPasswordPreflight, stagingPasswordContext } from '@/lib/auth'
import { StagingPasswordForm } from '@/components/admin/scheduling/staging-password-form'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const metadata: Metadata = {
  title: 'Staging password change | RRD Admin',
  description: 'Private, staging-only account password and session controls.',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
}

export default async function StagingPasswordPage() {
  const requestHeaders = await headers()
  const origin = `https://${requestHeaders.get('host') ?? ''}`
  if (!stagingPasswordContext(origin)) notFound()
  const preflight = await getStagingPasswordPreflight(origin).catch(() => null)
  if (!preflight?.authenticated) notFound()

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <section className="mx-auto flex max-w-2xl flex-col gap-8" aria-labelledby="staging-password-title">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">RRD Admin / Staging only</p>
          <h1 id="staging-password-title" className="text-3xl font-semibold tracking-tight">Change staging password</h1>
          <p className="text-sm text-muted-foreground">
            Only the account owner should enter passwords here. Loading this page does not change a password,
            revoke sessions, sign out, or grant Scheduling access. Production is excluded.
          </p>
        </header>
        <StagingPasswordForm initial={preflight} />
      </section>
    </main>
  )
}
