import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, Mail, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getBusinessProfile } from '@/lib/business-profile'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteConfig, siteUrl } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'About',
  description: 'Meet the person behind Rooster’s Ridge Digital and learn how practical digital help can support your next step.',
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: { title: `About — ${siteConfig.name}`, description: 'Practical digital help, without the agency runaround.', url: `${siteUrl}/about`, images: [ogMetadata('about')] },
  twitter: { card: 'summary_large_image', images: [twitterImage('about')] },
}

const principles = ['Clear communication', 'Honest project scope', 'Useful work over unnecessary extras', 'Designs tailored to the client', 'Practical solutions that can grow with the business']

export default async function AboutPage() {
  const profile = await getBusinessProfile()
  return <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
    <header className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The person behind the work</p><h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Practical digital help, without the agency runaround.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">You work directly with the person creating your materials, from the first conversation through final delivery.</p></header>
    <section className="mt-16 grid gap-10 border-y border-border py-10 md:grid-cols-[0.8fr_1.2fr] md:items-center"><div>{profile.founder_image_url ? <img src={profile.founder_image_url} alt={`${profile.founder_name}, ${profile.founder_title}`} className="aspect-square w-full max-w-sm rounded-2xl object-cover" /> : <div className="flex aspect-square w-full max-w-sm items-end rounded-2xl border border-dashed border-border bg-card p-6"><span className="text-sm text-muted-foreground">A founder photograph will appear here.</span></div>}</div><div className="max-w-2xl"><p className="text-sm font-medium text-primary">{profile.founder_title}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{profile.founder_name}</h2><p className="mt-6 text-base leading-8 text-muted-foreground">{profile.founder_bio}</p><div className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:gap-6"><span className="inline-flex items-center gap-2"><MapPin className="size-4 text-primary" />{profile.location}</span><a className="inline-flex items-center gap-2 hover:text-primary" href={`mailto:${profile.email}`}><Mail className="size-4 text-primary" />{profile.email}</a></div></div></section>
    <section className="grid gap-12 py-16 md:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Who this is for</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Good work should be accessible to more than big companies.</h2><p className="mt-5 leading-8 text-muted-foreground">Rooster’s Ridge Digital helps small businesses, independent professionals, organizations, and community projects build a credible digital presence without unnecessary complexity or overhead.</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">How we work</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Useful, clear, and built around your actual goals.</h2><ul className="mt-6 space-y-4">{principles.map((principle) => <li key={principle} className="flex gap-3 text-muted-foreground"><Check className="mt-0.5 size-5 shrink-0 text-primary" />{principle}</li>)}</ul></div></section>
    <section className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-primary/30 bg-primary/10 p-8 sm:flex-row sm:items-center"><div><h2 className="text-2xl font-semibold">Ready to make the next step clearer?</h2><p className="mt-2 text-muted-foreground">Tell us what you are working toward and we will help you scope the right project.</p></div><Button render={<Link href="/quote" />}>Get a Free Project Estimate <ArrowRight className="ml-2 size-4" /></Button></section>
  </div>
}
