import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Clock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Thank You',
  description: 'Your request has been received.',
  robots: { index: false },
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; type?: string; emailWarning?: string }>
}) {
  const { ref, type, emailWarning } = await searchParams
  const isCheckup = type === 'checkup'

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-4 py-20 text-center sm:px-6">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="size-8" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {isCheckup ? 'Your checkup request is in' : 'Thanks — we got your request'}
        </h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          {isCheckup
            ? "We'll review your digital presence and follow up with a personalized summary and the highest-impact next steps."
            : "We'll review the details you shared and reply with a clear plan and a free estimate."}
        </p>
      </div>

      {ref && (
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-1 pt-6">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Your reference number</span>
            <span className="font-mono text-xl font-semibold text-primary">{ref}</span>
            <span className="text-xs text-muted-foreground">Keep this for your records.</span>
          </CardContent>
        </Card>
      )}

      {emailWarning && (
        <Alert>
          <AlertDescription>
            Your request was saved successfully. A confirmation email may be delayed — rest assured we still received
            everything.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-5">
          <Clock className="size-5 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium">What happens next</p>
          <p className="text-xs text-muted-foreground">A real person reviews your request and follows up personally.</p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-5">
          <Mail className="size-5 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium">Check your inbox</p>
          <p className="text-xs text-muted-foreground">A confirmation is on its way. Add us to your contacts.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button render={<Link href="/" />}>Back to home</Button>
        <Button render={<Link href="/promotions" />} variant="outline">
          Explore our work
        </Button>
      </div>

      {siteConfig.contact.email && (
        <p className="text-sm text-muted-foreground">
          Need to add something? Email{' '}
          <a href={`mailto:${siteConfig.contact.email}`} className="font-medium text-primary hover:underline">
            {siteConfig.contact.email}
          </a>
        </p>
      )}
    </div>
  )
}
