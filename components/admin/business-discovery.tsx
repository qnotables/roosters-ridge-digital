'use client'

import { useState, useTransition } from 'react'
import { Search, ScanSearch } from 'lucide-react'
import { findBusinesses } from '@/app/actions/platform-scanner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { PlatformProspect } from '@/lib/platform-types'
import type { BusinessSearchResult } from '@/lib/business-discovery'

export function BusinessDiscovery({ busy, onCheck }: { busy: boolean; onCheck: (rows: PlatformProspect[]) => void }) {
  const [industry, setIndustry] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [maximum, setMaximum] = useState(10)
  const [result, setResult] = useState<BusinessSearchResult | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const disabled = pending || busy
  const candidates = result?.businesses.filter((row) => row.originalUrl) || []
  const chosen = candidates.filter((row) => selected.has(row.id))
  return <div className="flex flex-col gap-4">
    <form onSubmit={(event) => { event.preventDefault(); setError(''); setResult(null); setSelected(new Set()); startTransition(async () => { try {
        const response = await findBusinesses({ industry, city, state, maxResults: maximum })
        if (response.ok) setResult(response.data)
        else setError(response.error)
      } catch {
        setError('Could not connect to the business search. Refresh the page and try again, or use Import Websites.')
      } }) }}>
      <FieldGroup className="gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Field className="sm:min-w-40 sm:flex-1"><FieldLabel htmlFor="business-industry">Industry</FieldLabel><Input id="business-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Solar, Roofing, HVAC…" required maxLength={80} disabled={disabled} /></Field>
        <Field className="sm:min-w-32 sm:flex-1"><FieldLabel htmlFor="business-city">City</FieldLabel><Input id="business-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" required maxLength={80} disabled={disabled} /></Field>
        <Field className="sm:w-36"><FieldLabel htmlFor="business-state">State</FieldLabel><Input id="business-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="TX or Texas" required maxLength={80} disabled={disabled} /></Field>
        <Field className="sm:w-36"><FieldLabel htmlFor="business-maximum">Maximum results</FieldLabel><select id="business-maximum" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={maximum} onChange={(e) => setMaximum(Number(e.target.value))} disabled={disabled}>{[10, 25, 50].map((count) => <option key={count} value={count}>{count}</option>)}</select></Field>
        <Button type="submit" disabled={disabled}><Search data-icon="inline-start" />{pending ? 'Finding businesses…' : 'Find Businesses'}</Button>
      </FieldGroup>
    </form>
    <FieldDescription>Connected to OpenStreetMap via Private.coffee. No API key or setup required. US city boundaries only; directory coverage is limited, especially for contractors. Missing contact details are never guessed.</FieldDescription>
    {error && <Alert variant="destructive"><AlertTitle>Search unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {result && <section aria-label="Discovered businesses" className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{result.businesses.length} businesses found · {result.cached ? 'Cached search' : 'Live directory search'}</p><Button disabled={disabled || !chosen.length} onClick={() => onCheck(chosen)}><ScanSearch data-icon="inline-start" />Check Website Platform ({chosen.length})</Button></div>
      {result.businesses.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><caption className="sr-only">Business directory search results</caption><thead><tr className="border-b"><th scope="col" className="p-2"><Checkbox aria-label="Select all discovered businesses with websites" disabled={disabled || !candidates.length} checked={candidates.length > 0 && chosen.length === candidates.length} onCheckedChange={(checked) => setSelected(checked ? new Set(candidates.map((row) => row.id)) : new Set())} /></th><th scope="col" className="p-2">Business / website</th><th scope="col" className="p-2">Location / public phone</th><th scope="col" className="p-2">Source</th></tr></thead><tbody>{result.businesses.map((row) => <tr key={row.id} className="border-b align-top"><td className="p-2"><Checkbox aria-label={`Select ${row.businessName}`} checked={selected.has(row.id)} disabled={disabled || !row.originalUrl} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(row.id); else next.delete(row.id); return next })} /></td><td className="max-w-64 p-2"><p className="font-medium">{row.businessName}</p>{row.originalUrl ? <a href={row.originalUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs underline">{row.originalUrl}</a> : <p className="text-xs text-muted-foreground">No public website listed — cannot scan</p>}</td><td className="p-2"><p>{row.location}</p><p className="text-xs text-muted-foreground">{row.phone || 'No public phone listed'}</p></td><td className="p-2"><a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">View directory entry</a></td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">No matching businesses in this directory. Try another industry or city, or import known websites.</p>}
      <p className="text-xs text-muted-foreground">Data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors · ODbL</a> · <a href="https://overpass.private.coffee/" target="_blank" rel="noopener noreferrer" className="underline">Provider terms & privacy</a> · {new Date(result.searchedAt).toLocaleString()}</p>
    </section>}
  </div>
}
