'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { saveBusinessProfile } from '@/app/actions/business-profile'
import type { BusinessProfile } from '@/lib/business-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
const socials = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['x', 'X / Twitter'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['truth_social', 'Truth Social']] as const

export function ProfileEditor({ profile, userEmail }: { profile: BusinessProfile; userEmail: string }) {
  const [status, setStatus] = useState('')
  const [imageUrl, setImageUrl] = useState(profile.founder_image_url ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload() {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    const data = new FormData(); data.append('file', file)
    const response = await fetch('/api/admin/profile-image', { method: 'POST', body: data })
    const result = await response.json()
    if (response.ok) { setImageUrl(result.url); setStatus('Image uploaded and saved.') }
    else setStatus(result.error ?? 'Image upload failed.')
  }

  async function submit(formData: FormData) {
    formData.set('founder_image_url', imageUrl)
    try { await saveBusinessProfile(formData); setStatus('Profile saved.') } catch { setStatus('Profile could not be saved. Check the fields and try again.') }
  }

  return <main className="min-h-dvh bg-muted/20 px-4 py-10 sm:px-6"><div className="mx-auto max-w-4xl">
    <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Business profile</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">About page settings</h1><p className="mt-2 text-sm text-muted-foreground">Signed in as {userEmail}</p></div><div className="flex gap-2"><Button variant="outline" render={<Link href="/admin/portfolio" />}>Portfolio</Button><Button variant="outline" render={<Link href="/about" />}>View About</Button><Button variant="ghost" onClick={async () => { await fetch('/api/admin/sign-out', { method: 'POST' }); window.location.assign('/admin/sign-in') }}>Sign out</Button></div></div>
    <form action={submit} className="mt-8 space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-semibold">Founder information</h2><p className="mt-1 text-sm text-muted-foreground">Fields marked as “to be confirmed” are editable placeholders and are not shown with that wording publicly.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="founder_name">Founder name</Label><Input id="founder_name" name="founder_name" defaultValue={profile.founder_name} required /></div><div className="space-y-2"><Label htmlFor="founder_title">Founder title</Label><Input id="founder_title" name="founder_title" defaultValue={profile.founder_title} required /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="founder_bio">Biography</Label><Textarea id="founder_bio" name="founder_bio" defaultValue={profile.founder_bio} rows={6} required /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="location">Location or service area</Label><Input id="location" name="location" defaultValue={profile.location} required /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="founder_image">Founder photograph</Label><div className="flex flex-wrap gap-3"><Input ref={inputRef} id="founder_image" type="file" accept="image/jpeg,image/png,image/webp" /><Button type="button" variant="outline" onClick={upload}>Upload image</Button></div>{imageUrl && <img src={imageUrl} alt="Current founder photograph" className="mt-4 size-24 rounded-xl object-cover" />}</div></div></section>
      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-semibold">Contact and response</h2><div className="mt-6 grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="email">Business email</Label><Input id="email" name="email" type="email" defaultValue={profile.email} required /></div><div className="space-y-2"><Label htmlFor="phone">Business phone</Label><Input id="phone" name="phone" defaultValue={profile.phone ?? ''} /></div><div className="flex items-center gap-3 sm:col-span-2"><Checkbox id="show_phone" name="show_phone" defaultChecked={profile.show_phone} /><Label htmlFor="show_phone">Show phone number publicly</Label></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="response_time">Typical response-time message</Label><Input id="response_time" name="response_time" defaultValue={profile.response_time ?? ''} placeholder="Usually replies within 1–2 business days." /></div></div></section>
      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-semibold">Social links</h2><div className="mt-6 space-y-5">{socials.map(([key, label]) => <div key={key} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div className="space-y-2"><Label htmlFor={`${key}_url`}>{label} URL</Label><Input id={`${key}_url`} name={`${key}_url`} type="url" defaultValue={profile[`${key}_url` as keyof BusinessProfile] as string ?? ''} placeholder="https://" /></div><label className="flex items-center gap-2 pb-2 text-sm"><Checkbox name={`show_${key}`} defaultChecked={profile[`show_${key}` as keyof BusinessProfile] as boolean} />Show publicly</label></div>)}<div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="additional_social_label">Additional link label</Label><Input id="additional_social_label" name="additional_social_label" defaultValue={profile.additional_social_label ?? ''} /></div><div className="space-y-2"><Label htmlFor="additional_social_url">Additional link URL</Label><Input id="additional_social_url" name="additional_social_url" type="url" defaultValue={profile.additional_social_url ?? ''} /></div></div><label className="flex items-center gap-2 text-sm"><Checkbox name="show_additional_social" defaultChecked={profile.show_additional_social} />Show additional link publicly</label></div></section>
      <div className="flex items-center justify-between gap-4"><p role="status" className="text-sm text-muted-foreground">{status}</p><Button type="submit">Save profile</Button></div>
    </form>
  </div></main>
}
