import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
import { BrandMark } from '@/components/brand-mark'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <BrandMark className="size-10" />
      <div className="flex flex-col gap-2">
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight">This page flew the coop</h1>
        <p className="max-w-md text-pretty text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back on track.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button render={<Link href="/" />}>Back to home</Button>
        <Button render={<Link href="/services" />} variant="outline">
          View services
        </Button>
      </div>
    </div>
  )
}
