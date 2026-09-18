'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Search, Users, FileText, ClipboardCheck, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  formatLeadDate,
  leadDisplayName,
  leadInitials,
  leadReportFields,
  leadSourceLabel,
  leadTypeLabel,
  type LeadReportRow,
} from '@/lib/leads-report-types'

type Filter = 'all' | 'quote' | 'checkup'

function valueOrDash(value: string | null) {
  return value || '—'
}

export function LeadsReport({ leads }: { leads: LeadReportRow[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | number | null>(null)

  const quoteCount = leads.filter((lead) => lead.lead_type === 'quote').length
  const checkupCount = leads.filter((lead) => lead.lead_type === 'checkup').length
  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return leads.filter((lead) => {
      if (filter !== 'all' && lead.lead_type !== filter) return false
      if (!normalizedQuery) return true
      return [
        leadDisplayName(lead),
        lead.business_name,
        lead.email,
        lead.reference_number,
        lead.primary_concern,
        lead.project_description,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))
    })
  }, [filter, leads, query])

  return (
    <main className="min-h-dvh bg-muted/20 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Admin dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Lead report</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review every quote request and free checkup submission in one place.</p>
          </div>
          <nav aria-label="Dashboard navigation" className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/admin/profile" />}>Profile</Button>
            <Button variant="outline" render={<Link href="/admin/portfolio" />}>Portfolio</Button>
            <Button variant="ghost" render={<Link href="/" />}>View site</Button>
          </nav>
        </header>

        <section aria-label="Lead summary" className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Total leads" value={leads.length} icon={<Users aria-hidden="true" />} />
          <SummaryCard label="Quote requests" value={quoteCount} icon={<FileText aria-hidden="true" />} />
          <SummaryCard label="Free checkups" value={checkupCount} icon={<ClipboardCheck aria-hidden="true" />} />
        </section>

        <section className="mt-8 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recent inquiries</h2>
              <p className="mt-1 text-sm text-muted-foreground">{filteredLeads.length} of {leads.length} leads shown</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-64">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads" aria-label="Search leads" className="pl-10" />
              </div>
              <div className="flex rounded-md border border-border p-1" role="group" aria-label="Filter leads">
                {(['all', 'quote', 'checkup'] as Filter[]).map((item) => (
                  <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${filter === item ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {item === 'all' ? 'All' : item === 'quote' ? 'Quotes' : 'Checkups'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Lead submissions</caption>
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Lead</th>
                    <th scope="col" className="px-5 py-3 font-medium">Type</th>
                    <th scope="col" className="px-5 py-3 font-medium">Source</th>
                    <th scope="col" className="px-5 py-3 font-medium">Received</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeads.map((lead) => {
                    const isOpen = openId === lead.id
                    return (
                      <tr key={lead.id} className="align-top">
                        <td colSpan={5} className="p-0">
                          <div className="grid grid-cols-[minmax(220px,1fr)_150px_150px_190px_100px] items-center">
                            <div className="flex items-center gap-3 px-5 py-4">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">{leadInitials(lead)}</div>
                              <div className="min-w-0"><p className="truncate font-medium">{leadDisplayName(lead)}</p><p className="truncate text-xs text-muted-foreground">{valueOrDash(lead.business_name)} · {lead.email}</p></div>
                            </div>
                            <div className="px-5 py-4"><Badge variant={lead.lead_type === 'quote' ? 'default' : 'secondary'}>{leadTypeLabel(lead.lead_type)}</Badge></div>
                            <div className="px-5 py-4 text-sm text-muted-foreground">{leadSourceLabel(lead.source_page)}</div>
                            <div className="px-5 py-4 text-sm text-muted-foreground">{formatLeadDate(lead.created_at)}</div>
                            <div className="px-5 py-4 text-right"><Button variant="ghost" size="sm" onClick={() => setOpenId(isOpen ? null : lead.id)} aria-expanded={isOpen}>{isOpen ? 'Hide' : 'View'}</Button></div>
                          </div>
                          {isOpen && <LeadDetails lead={lead} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"><Users aria-hidden="true" className="text-muted-foreground" /><h3 className="font-semibold">No leads match this view</h3><p className="text-sm text-muted-foreground">Try a different filter or search term.</p></div>
          )}
        </section>
      </div>
    </main>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle><span className="text-primary">{icon}</span></CardHeader><CardContent><p className="text-3xl font-semibold tracking-tight">{value}</p></CardContent></Card>
}

function LeadDetails({ lead }: { lead: LeadReportRow }) {
  return <div className="border-t border-border bg-muted/20 px-5 py-5"><div className="flex flex-col gap-5 lg:flex-row lg:justify-between"><div className="grid flex-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{leadReportFields.map(({ label, key }) => <div key={key}><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{key === 'website_url' && lead[key] ? <a href={String(lead[key])} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">{String(lead[key])}<ExternalLink aria-hidden="true" /></a> : valueOrDash(lead[key] as string | null)}</dd></div>)}</div><div className="shrink-0 text-sm lg:w-56"><p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p><p className="mt-1 font-mono text-primary">{lead.reference_number}</p></div></div><div className="mt-6 grid gap-5 border-t border-border pt-5 md:grid-cols-2"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Services</p><p className="mt-1 text-sm">{lead.services.length ? lead.services.join(', ') : '—'}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Project description / concern</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{lead.project_description || lead.primary_concern || '—'}</p></div></div><div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">UTM campaign</p><p className="mt-1 text-sm">{lead.utm_campaign || '—'}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">UTM source / medium</p><p className="mt-1 text-sm">{[lead.utm_source, lead.utm_medium].filter(Boolean).join(' / ') || '—'}</p></div></div></div>
}
