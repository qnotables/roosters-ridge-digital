import type { ReactNode } from 'react'

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="print-page min-h-dvh bg-background">{children}</div>
}
