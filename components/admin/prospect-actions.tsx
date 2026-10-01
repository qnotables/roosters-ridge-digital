'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { saveProspectAsLead, saveWebsiteNotes } from '@/app/actions/platform-scanner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import type { PlatformProspect } from '@/lib/platform-types'

export function ProspectActions({ row, existingLead, busy }: { row: PlatformProspect; existingLead: boolean; busy: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(row.notes)
  const [pending, startTransition] = useTransition()
  return <div className="mt-3 flex flex-col items-start gap-2">
    {row.savedAt || existingLead ? <Badge variant="secondary">{existingLead ? 'Existing inquiry' : 'Saved lead'}</Badge> : <Button size="sm" variant="outline" disabled={busy || pending} onClick={() => startTransition(async () => { try { await saveProspectAsLead(row.id); router.refresh(); toast.success('Saved to your prospect leads') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save lead') } })}>Save as lead</Button>}
    <Button size="sm" variant="ghost" disabled={busy || pending} onClick={() => { setNotes(row.notes); setEditing(!editing) }}>Edit notes</Button>
    {editing && <form className="w-full min-w-48" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { try { await saveWebsiteNotes(row, notes); setEditing(false); router.refresh(); toast.success('Notes saved') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save notes') } }) }}><FieldGroup className="gap-2"><Field><FieldLabel htmlFor={`notes-${row.id}`}>Prospect notes</FieldLabel><Textarea id={`notes-${row.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={10000} rows={4} disabled={pending} /></Field><div className="flex gap-2"><Button type="submit" size="sm" disabled={pending}>Save notes</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button></div></FieldGroup></form>}
    {row.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) && <a className="text-xs underline" href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Website question for ${row.businessName || 'your business'}`)}&body=${encodeURIComponent('Hello,\n\nI would like to learn more about your website goals.\n\n')}`}>Draft email</a>}
  </div>
}
