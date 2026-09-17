import type { Metadata } from 'next'
import { SignInForm } from './sign-in-form'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminSignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Admin access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Enter your dashboard key</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Use the private key configured for this site to manage the business profile.</p>
        <SignInForm />
      </section>
    </main>
  )
}
