import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="print-page min-h-dvh bg-background">{children}</div>
}
