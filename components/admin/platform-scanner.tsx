'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ScanSearch } from 'lucide-react'
import { toast } from 'sonner'
import { importPlatformProspects, scanProspectPlatform } from '@/app/actions/platform-scanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { filterPlatformProspects, platformCheckForUrl, platformProspectsCsv, type PlatformCheck, type PlatformProspect } from '@/lib/platform-types'
import { leadDisplayName, type LeadReportRow } from '@/lib/leads-report-types'

type ProspectRow = PlatformProspect & { lead?: Record<string, unknown> }
export function PlatformScanner({ leads, prospects, checks }: { leads: LeadReportRow[]; prospects: PlatformProspect[]; checks: Record<string, PlatformCheck> }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [wixOnly, setWixOnly] = useState(false)
  const [progress, setProgress] = useState('')
  const [pending, startTransition] = useTransition()
  const rows = useMemo<ProspectRow[]>(() => [
    ...leads.filter((lead) => lead.website_url).map((lead) => ({ id: `lead-${lead.id}`, originalUrl: lead.website_url!, businessName: lead.business_name || '', contactName: leadDisplayName(lead), email: lead.email, phone: lead.phone || '', notes: [lead.project_description, lead.primary_concern].filter(Boolean).join('\n'), lead: { ...lead } })),
    ...prospects,
  ], [leads, prospects])
  const filtered = filterPlatformProspects(rows, checks, wixOnly, query)
  function runChecks(urls: string[]) {
    startTransition(async () => {
      const unique = [...new Set(urls)]
      let completed = 0
      try {
        for (const url of unique) {
          setProgress(`Checking ${completed + 1} of ${unique.length}: ${url}`)
          await scanProspectPlatform(url)
          completed++
        }
        toast.success(`${completed} website checks completed`)
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Platform check failed') }
      finally { setProgress(''); router.refresh() }
    })
  }
  function exportCsv() {
    const blob = new Blob([platformProspectsCsv(filtered, checks)], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = wixOnly ? 'rrd-wix-prospects.csv' : 'rrd-prospects.csv'
    link.click()
    URL.revokeObjectURL(href)
  }
  return <Card className="mt-8">
    <CardHeader><CardTitle>Prospect platform qualification</CardTitle><CardDescription>Identify likely Wix websites using public DNS and live-page evidence. Platform alone says nothing about analytics, performance, or revenue. No prospects are contacted.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-6">
      <form onSubmit={(event) => { event.preventDefault(); startTransition(async () => { try { await importPlatformProspects(text); setText(''); router.refresh(); toast.success('Websites imported; existing records preserved') } catch (error) { toast.error(error instanceof Error ? error.message : 'Import failed') } }) }} className="flex flex-col gap-3">
        <Field><FieldLabel htmlFor="prospect-websites">Import website URLs</FieldLabel><Textarea id="prospect-websites" value={text} onChange={(event) => setText(event.target.value)} placeholder="https://business.com | Business name | Contact | Email | Phone | Notes" rows={3} maxLength={50000} disabled={pending} /><FieldDescription>One URL per line, up to 50. Optional fields are separated by |. Duplicate URLs never overwrite saved contact details or notes.</FieldDescription></Field>
        <div><Button type="submit" variant="outline" disabled={pending || !text.trim()}>Import websites</Button></div>
      </form>
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-48 flex-1"><FieldLabel htmlFor="prospect-search">Search prospects</FieldLabel><Input id="prospect-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, contact, URL, or notes" /></Field>
        <Button variant={wixOnly ? 'secondary' : 'outline'} aria-pressed={wixOnly} onClick={() => setWixOnly(!wixOnly)}>Platform: Wix</Button>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download data-icon="inline-start" />Export matching CSV</Button>
        <Button onClick={() => runChecks(filtered.map((row) => row.originalUrl))} disabled={pending || !filtered.length}><ScanSearch data-icon="inline-start" />{pending ? 'Working…' : 'Check shown websites'}</Button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">{progress || `${filtered.length} of ${rows.length} prospects shown. 24-hour cache · 60 new checks/hour · Wix filter includes high and medium confidence, not unknown.`}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm"><caption className="sr-only">Prospect platform detection results</caption><thead><tr className="border-b"><th scope="col" className="p-3">Business / contact</th><th scope="col" className="p-3">Website</th><th scope="col" className="p-3">Platform / evidence</th><th scope="col" className="p-3">Check</th></tr></thead><tbody>
          {filtered.map((row) => { const check = platformCheckForUrl(checks, row.originalUrl); return <tr key={row.id} className="border-b align-top"><td className="p-3"><p className="font-medium">{row.businessName || row.contactName || 'Imported website'}</p><p className="text-xs text-muted-foreground">{row.contactName}</p><p className="break-all text-xs">{row.email}</p><p className="text-xs">{row.phone}</p>{row.notes && <details className="mt-2"><summary className="cursor-pointer text-xs">Existing notes</summary><p className="max-w-64 whitespace-pre-wrap text-xs">{row.notes}</p></details>}</td><td className="max-w-64 break-all p-3"><p>{row.originalUrl}</p>{check?.finalUrl && check.finalUrl !== row.originalUrl && <p className="mt-2 text-xs text-muted-foreground">Final: {check.finalUrl}</p>}</td><td className="max-w-80 p-3"><Badge variant={check?.confidence === 'high' ? 'default' : 'outline'}>{check ? `${check.platform} · ${check.confidence}` : 'Not checked'}</Badge>{check && <><p className="mt-2 text-xs text-muted-foreground">{new Date(check.checkedAt).toLocaleString()}</p><details className="mt-2"><summary className="cursor-pointer text-xs">Detection evidence</summary><ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs">{check.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul></details></>}</td><td className="p-3"><Button variant="ghost" size="sm" disabled={pending} onClick={() => runChecks([row.originalUrl])}>Check</Button></td></tr> })}
          {!filtered.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No matching prospects. Import URLs or check existing lead websites first.</td></tr>}
        </tbody></table>
      </div>
    </CardContent>
  </Card>
}
