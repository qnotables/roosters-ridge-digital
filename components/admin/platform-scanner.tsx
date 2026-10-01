'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ScanSearch } from 'lucide-react'
import { toast } from 'sonner'
import { importPlatformProspects, importDiscoveredBusinesses, scanProspectPlatform } from '@/app/actions/platform-scanner'
import { BusinessDiscovery } from '@/components/admin/business-discovery'
import { ProspectActions } from '@/components/admin/prospect-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { filterPlatformProspects, platformCheckForUrl, platformAttemptForUrl, platformProspectsCsv, prospectWebsiteKey, prospectWebsiteHref, uncheckedProspects, type PlatformAttempt, type PlatformCheck, type PlatformFilter, type PlatformProspect } from '@/lib/platform-types'
import { leadDisplayName, type LeadReportRow } from '@/lib/leads-report-types'

type ProspectRow = PlatformProspect & { lead?: Record<string, unknown> }
const filters: Array<[PlatformFilter, string]> = [['all', 'All Platforms'], ['unchecked', 'Unchecked'], ['wix-high', 'Wix High Confidence'], ['wix-medium', 'Wix Medium Confidence'], ['other', 'Other'], ['unknown', 'Unknown'], ['failed', 'Failed Checks']]
export function PlatformScanner({ leads, prospects, checks, attempts = {} }: { leads: LeadReportRow[]; prospects: PlatformProspect[]; checks: Record<string, PlatformCheck>; attempts?: Record<string, PlatformAttempt> }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PlatformFilter>('all')
  const [savedOnly, setSavedOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState('')
  const [localChecks, setLocalChecks] = useState<Record<string, PlatformCheck>>({})
  const [localAttempts, setLocalAttempts] = useState<Record<string, PlatformAttempt | null>>({})
  const [pending, startTransition] = useTransition()
  const currentChecks = { ...checks, ...localChecks }
  const currentAttempts = Object.fromEntries(Object.entries({ ...attempts, ...localAttempts }).filter((entry): entry is [string, PlatformAttempt] => Boolean(entry[1])))
  const rows = useMemo<ProspectRow[]>(() => {
    const records = new Map<string, ProspectRow>()
    for (const lead of leads.filter((item) => item.website_url)) {
      const row = { id: `lead-${lead.id}`, originalUrl: lead.website_url!, businessName: lead.business_name || '', contactName: leadDisplayName(lead), email: lead.email, phone: lead.phone || '', notes: [lead.project_description, lead.primary_concern].filter(Boolean).join('\n'), lead: { ...lead } }
      records.set(prospectWebsiteKey(row.originalUrl), row)
    }
    for (const prospect of prospects) {
      const key = prospectWebsiteKey(prospect.originalUrl)
      const inquiry = records.get(key)
      records.set(key, { ...prospect, lead: inquiry?.lead, businessName: prospect.businessName || inquiry?.businessName || '', contactName: prospect.contactName || inquiry?.contactName || '', email: prospect.email || inquiry?.email || '', phone: prospect.phone || inquiry?.phone || '' })
    }
    return [...records.values()]
  }, [leads, prospects])
  const filtered = filterPlatformProspects(rows, currentChecks, filter, query, currentAttempts).filter((row) => !savedOnly || row.savedAt || row.lead)
  const selectedRows = rows.filter((row) => selected.has(prospectWebsiteKey(row.originalUrl)))
  const unchecked = uncheckedProspects(rows, currentChecks, currentAttempts)
  function toggle(row: ProspectRow, checked: boolean) {
    setSelected((current) => { const next = new Set(current); const key = prospectWebsiteKey(row.originalUrl); if (checked) next.add(key); else next.delete(key); return next })
  }
  function runChecks(urls: string[], discovered?: PlatformProspect[]) {
    startTransition(async () => {
      const unique = [...new Set(urls)]
      let completed = 0, failed = 0
      try {
        if (discovered) {
          setProgress('Saving selected businesses…')
          const saved = await importDiscoveredBusinesses(discovered)
          toast.success(`${saved.inserted} imported · ${saved.skipped} duplicates preserved`)
        }
        for (const [index, url] of unique.entries()) {
          setProgress(`Checking ${index + 1} of ${unique.length} · ${completed} completed · ${failed} failed · ${url}`)
          try {
            const result = await scanProspectPlatform(url)
            setLocalChecks((previous) => ({ ...previous, [result.originalUrl]: result }))
            setLocalAttempts((previous) => {
              const next = { ...previous, [result.originalUrl]: null }
              for (const key of [...Object.keys(attempts), ...Object.keys(previous)]) {
                if (prospectWebsiteKey(key) === prospectWebsiteKey(result.originalUrl)) next[key] = null
              }
              return next
            })
            if (result.status === 'failed') failed++; else completed++
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Website check failed'
            setLocalAttempts((previous) => ({ ...previous, [url]: { error: message, attemptedAt: new Date().toISOString() } }))
            failed++
          }
        }
        setProgress(`${unique.length} processed · ${completed} completed · ${failed} failed. Unknown means a page was checked without a confirmed platform; failed checks can be retried.`)
        if (failed) toast.warning(`${completed} completed · ${failed} failed`); else toast.success(`${completed} website checks completed`)
      } catch (error) { setProgress(''); toast.error(error instanceof Error ? error.message : 'Unable to save discovered businesses') }
      finally { router.refresh() }
    })
  }
  function exportCsv() {
    const blob = new Blob([platformProspectsCsv(selectedRows, currentChecks, currentAttempts)], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href; link.download = 'rrd-selected-prospects.csv'; link.click(); URL.revokeObjectURL(href)
  }
  return <Card className="mt-8">
    <CardHeader><CardTitle>Discover & qualify</CardTitle><CardDescription>Find a business, check its website, and keep promising prospects. No outreach is sent automatically.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-6">
      <Tabs defaultValue="find"><TabsList className="mb-4"><TabsTrigger value="find">FIND BUSINESSES</TabsTrigger><TabsTrigger value="import">IMPORT WEBSITES</TabsTrigger></TabsList>
        <TabsContent value="find" keepMounted className="data-[hidden]:hidden"><BusinessDiscovery busy={pending} onCheck={(found) => runChecks(found.map((row) => row.originalUrl), found)} /></TabsContent>
        <TabsContent value="import" keepMounted className="data-[hidden]:hidden"><form onSubmit={(event) => { event.preventDefault(); startTransition(async () => { try { const result = await importPlatformProspects(text); setText(''); router.refresh(); toast.success(`${result.inserted} imported · ${result.skipped} duplicates preserved`) } catch (error) { toast.error(error instanceof Error ? error.message : 'Import failed') } }) }}><FieldGroup className="gap-3"><Field><FieldLabel htmlFor="prospect-websites">Website URLs & optional contacts</FieldLabel><Textarea id="prospect-websites" value={text} onChange={(event) => setText(event.target.value)} placeholder="https://business.com | Business name | Contact | Email | Phone | Notes" rows={3} maxLength={50000} disabled={pending} /><FieldDescription>One URL per line, up to 50. Optional fields use | separators. Duplicates never overwrite saved contacts or notes.</FieldDescription></Field><div><Button type="submit" variant="outline" disabled={pending || !text.trim()}>Import websites</Button></div></FieldGroup></form></TabsContent>
      </Tabs>
      <section aria-label="Prospect results" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-48 flex-1"><FieldLabel htmlFor="prospect-search">Search prospects</FieldLabel><Input id="prospect-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, URL, location, or notes" /></Field>
          <Field className="sm:w-52"><FieldLabel htmlFor="platform-filter">Platform</FieldLabel><select id="platform-filter" value={filter} onChange={(e) => setFilter(e.target.value as PlatformFilter)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Button variant={savedOnly ? 'secondary' : 'outline'} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>Saved leads</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runChecks(unchecked.map((row) => row.originalUrl))} disabled={pending || !unchecked.length}><ScanSearch data-icon="inline-start" />Scan Unchecked ({unchecked.length})</Button>
          <Button variant="outline" onClick={() => runChecks(selectedRows.map((row) => row.originalUrl))} disabled={pending || !selectedRows.length}>Scan Selected ({selectedRows.length})</Button>
          <Button variant="outline" onClick={exportCsv} disabled={!selectedRows.length}><Download data-icon="inline-start" />Export selected ({selectedRows.length})</Button>
          {!!selected.size && <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>}
        </div>
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">{progress || `${filtered.length} of ${rows.length} prospects shown · ${selectedRows.length} selected across all filters. Scan Unchecked includes failed checks and ignores view filters.`}</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><caption className="sr-only">Prospect platform detection results</caption><thead><tr className="border-b"><th scope="col" className="p-3"><Checkbox aria-label="Select all visible prospects" checked={filtered.length > 0 && filtered.every((row) => selected.has(prospectWebsiteKey(row.originalUrl)))} disabled={!filtered.length || pending} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); for (const row of filtered) { if (checked) next.add(prospectWebsiteKey(row.originalUrl)); else next.delete(prospectWebsiteKey(row.originalUrl)) } return next })} /></th><th scope="col" className="p-3">Business / contact</th><th scope="col" className="p-3">Website / location</th><th scope="col" className="p-3">Platform / evidence</th><th scope="col" className="p-3">Actions</th></tr></thead><tbody>
          {filtered.map((row) => {
            const check = platformCheckForUrl(currentChecks, row.originalUrl)
            const attempt = platformAttemptForUrl(currentAttempts, row.originalUrl)
            const failed = check?.status === 'failed' || Boolean(attempt)
            return <tr key={prospectWebsiteKey(row.originalUrl)} className="border-b align-top"><td className="p-3"><Checkbox aria-label={`Select ${row.businessName || row.originalUrl}`} checked={selected.has(prospectWebsiteKey(row.originalUrl))} disabled={pending} onCheckedChange={(checked) => toggle(row, Boolean(checked))} /></td><td className="max-w-52 p-3"><p className="font-medium">{row.businessName || row.contactName || 'Imported website'}</p>{row.contactName && <p className="text-xs text-muted-foreground">{row.contactName}</p>}<p className="break-all text-xs">{row.email}</p><p className="text-xs">{row.phone || 'No public phone saved'}</p>{row.notes && <details className="mt-2"><summary className="cursor-pointer text-xs">Notes</summary><p className="whitespace-pre-wrap text-xs">{row.notes}</p></details>}</td><td className="max-w-56 break-words p-3"><a href={prospectWebsiteHref(row.originalUrl)} target="_blank" rel="noopener noreferrer" className="break-all underline">{row.originalUrl}</a><p className="mt-2 text-xs text-muted-foreground">{row.location || 'Location not provided'}</p>{row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Source: OpenStreetMap</a>}{check?.finalUrl && check.finalUrl !== row.originalUrl && <p className="mt-2 break-all text-xs text-muted-foreground">Final: {check.finalUrl}</p>}</td><td className="max-w-64 p-3"><Badge variant={failed ? 'destructive' : check?.confidence === 'high' ? 'default' : 'outline'}>{failed ? 'Check failed' : check ? `${check.platform} · ${check.confidence}` : 'Unchecked'}</Badge>{check?.status === 'partial' && !failed && <p className="mt-2 text-xs">Partial check — some observations unavailable</p>}{attempt && <p className="mt-2 text-xs text-destructive">{attempt.error} · Attempted {new Date(attempt.attemptedAt).toLocaleString()}</p>}{check && <><p className="mt-2 text-xs text-muted-foreground">Last checked: {new Date(check.checkedAt).toLocaleString()}</p><details className="mt-2"><summary className="cursor-pointer text-xs">Detection evidence</summary><ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs">{check.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul></details></>}</td><td className="w-44 p-3"><Button variant="ghost" size="sm" disabled={pending} onClick={() => runChecks([row.originalUrl])}>{failed ? 'Retry check' : 'Check'}</Button><ProspectActions row={row} existingLead={Boolean(row.lead)} busy={pending} /></td></tr>
          })}
          {!filtered.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No matching prospects. Find businesses, import websites, or choose All Platforms.</td></tr>}
        </tbody></table></div>
        <p className="text-xs text-muted-foreground">Saved leads stay in this prospect list, separate from submitted inquiries below. Draft email opens your email app for review and never sends automatically.</p>
      </section>
      <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">How detection works</summary><div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground"><p>Detection preserves the existing public DNS and live-page Wix rules. High confidence requires matching CNAME and live Wix identifiers; DNS-only or incomplete evidence is medium confidence. Platform alone says nothing about analytics, performance, or revenue.</p><p>Unknown means no supported platform is confirmed; it is not proof of a non-Wix website. Other is reserved for a positively identified non-Wix platform. The current detector supports Wix only, so Other may be empty. Failed checks remain separate and retryable.</p><p>Website checks use the existing 24-hour cache and 60 uncached checks per hour. Business searches use a separate 24-hour cache and one new search per minute. Private.coffee requires no account or credential; outages and missing mapped city boundaries appear as real errors, never sample results.</p><p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors · ODbL</a> — verify public details at their source before outreach. Only directory-provided names and contacts are returned; no owner names or email addresses are inferred.</p></div></details>
    </CardContent>
  </Card>
}
