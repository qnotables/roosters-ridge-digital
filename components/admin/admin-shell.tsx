'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, BriefcaseBusiness, Calculator, ExternalLink, FileText, LogOut, Mail, Menu, Settings2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'

const navigation = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/leads', label: 'Leads', icon: FileText },
  { href: '/admin/email', label: 'Email', icon: Mail },
  { href: '/admin/inbox', label: 'Inbox', icon: Mail },
  { href: '/admin/portfolio', label: 'Portfolio', icon: BriefcaseBusiness },
  { href: '/admin/estimating', label: 'Estimates', icon: FileText },
  { href: '/admin/pricing', label: 'Pricing library', icon: Calculator },
  { href: '/admin/estimating/new', label: 'New estimate', icon: Settings2 },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function signOut() {
    const [staffResult, dashboardResult] = await Promise.allSettled([
      authClient.signOut(),
      fetch('/api/admin/sign-out', { method: 'POST' }),
    ])
    if (dashboardResult.status === 'rejected' || !dashboardResult.value.ok) {
      toast.error('Could not clear dashboard access. Please retry signing out.')
      return
    }
    if (staffResult.status === 'rejected' || staffResult.value.error) {
      toast.warning('Dashboard access cleared, but the staff session could not be cleared. Sign out of the staff account when access is restored.')
    }
    router.push('/admin/sign-in')
    router.refresh()
  }

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">RR</span>
            <span className="hidden min-w-0 sm:block"><span className="block truncate text-sm font-semibold">Rooster&apos;s Ridge Digital</span><span className="block text-xs text-muted-foreground">Internal dashboard</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/" />}><ExternalLink data-icon="inline-start" />View site</Button>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</Button>
            <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={signOut}><LogOut data-icon="inline-start" />Sign out</Button>
          </div>
        </div>
        <div className={cn('border-t border-border md:block', open ? 'block' : 'hidden')}>
          <nav aria-label="Admin dashboard navigation" className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-1 md:py-2">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
              return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors', active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon className="size-4" />{label}</Link>
            })}
            <Link href="/admin/profile" onClick={() => setOpen(false)} className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors md:ml-auto', pathname.startsWith('/admin/profile') ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Settings2 className="size-4" />Business profile</Link>
            <button type="button" onClick={signOut} className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"><LogOut className="size-4" />Sign out</button>
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
