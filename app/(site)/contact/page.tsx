import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { siteUrl } from '@/lib/site-config'

export const metadata: Metadata = { title: 'Contact Rooster Ridge Digital', description: 'Start a conversation about a website, lead-generation system, automation, dashboard, or custom digital platform.', alternates: { canonical: `${siteUrl}/contact` } }

export default function ContactPage() {
  return <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24"><div className="max-w-3xl"><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Contact</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Let&apos;s talk about what your business needs next.</h1><p className="mt-6 text-lg leading-relaxed text-muted-foreground">Tell us what is working, what is getting in the way, and what you want your digital system to do. We&apos;ll help shape the right next step.</p><div className="mt-8 flex flex-wrap gap-3"><Button render={<Link href="/quote" />}>Start a project <ArrowRight data-icon="inline-end" /></Button><Button render={<Link href="/free-checkup" />} variant="outline">Get a free checkup</Button></div></div><div className="mt-16 grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-border bg-card p-6"><Mail className="size-5 text-primary" aria-hidden="true" /><h2 className="mt-4 font-semibold">Email the studio</h2><a className="mt-2 block text-sm text-muted-foreground hover:text-primary" href="mailto:rooster@roostersridgedigital.com">rooster@roostersridgedigital.com</a></div><div className="rounded-lg border border-border bg-card p-6"><Phone className="size-5 text-primary" aria-hidden="true" /><h2 className="mt-4 font-semibold">Use the project form</h2><p className="mt-2 text-sm text-muted-foreground">Share your goals, timeline, and the systems you already use.</p><Link className="mt-4 inline-flex text-sm font-medium text-primary hover:underline" href="/quote">Open project form <ArrowRight className="ml-2 size-4" /></Link></div></div></section>
}
