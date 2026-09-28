'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AirVent, ArrowRight, Calculator, CalendarDays, Check, CircuitBoard, Clock3, Flower2, HeartHandshake, House, MapPin, Phone, ShoppingBag, Upload, UserRound, Zap } from 'lucide-react'
import type { Industry } from '@/data/industries'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const themeClasses = {
  solar: 'from-amber-500/20 via-background to-sky-500/10',
  roofing: 'from-red-950/30 via-background to-orange-500/10',
  hvac: 'from-cyan-500/15 via-background to-blue-500/10',
  electrical: 'from-violet-500/15 via-background to-yellow-500/10',
  landscaping: 'from-emerald-500/15 via-background to-lime-500/10',
  nonprofit: 'from-rose-500/15 via-background to-indigo-500/10',
  ecommerce: 'from-fuchsia-500/15 via-background to-orange-500/10',
  'professional-services': 'from-slate-400/15 via-background to-primary/10',
}

const variantLabels = {
  solar: 'Warm, analytical, savings-led', roofing: 'Urgent, grounded, trust-first', hvac: 'Cool, responsive, service-led', electrical: 'Technical, clear, high-contrast', landscaping: 'Organic, visual, transformation-led', nonprofit: 'Human, hopeful, impact-led', ecommerce: 'Product-led, tactile, conversion-focused', 'professional-services': 'Editorial, composed, expertise-led',
}

export function IndustryDemo({ industry }: { industry: Industry }) {
  const [mode, setMode] = useState('Residential')
  const [submitted, setSubmitted] = useState(false)
  const Icon = { calculator: Calculator, house: House, 'air-vent': AirVent, 'circuit-board': CircuitBoard, 'flower-2': Flower2, 'heart-handshake': HeartHandshake, 'shopping-bag': ShoppingBag, 'user-round': UserRound }[industry.iconName]
  const isCommerce = industry.variant === 'ecommerce'
  const isMission = industry.variant === 'nonprofit'

  return (
    <div className={cn('min-h-screen bg-gradient-to-br', themeClasses[industry.variant])}>
      <div className="border-b border-border/80 bg-background/80 px-4 py-2 text-center text-xs text-muted-foreground backdrop-blur sm:px-6">
        Interactive demonstration created by Rooster&apos;s Ridge Digital — this is not an active {industry.name.toLowerCase()} business.
      </div>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-20">
        <div className="flex flex-col gap-6">
          <Badge variant="outline" className="w-fit gap-2"><Icon aria-hidden="true" /> Interactive Industry Demo</Badge>
          <div className="flex flex-col gap-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{variantLabels[industry.variant]}</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{industry.hero}</h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{industry.subhead}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button render={<a href="#demo-form" />}>{industry.cta}<ArrowRight data-icon="inline-end" /></Button>
            <Button render={<Link href="/quote" />} variant="outline">Build something like this</Button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button nativeButton={true} onClick={() => setMode('Residential')} variant={mode === 'Residential' ? 'secondary' : 'ghost'} size="sm">Residential</Button>
            <Button nativeButton={true} onClick={() => setMode('Commercial')} variant={mode === 'Commercial' ? 'secondary' : 'ghost'} size="sm">Commercial</Button>
            <span className="self-center text-xs text-muted-foreground">Previewing the {mode.toLowerCase()} journey</span>
          </div>
        </div>
        <Card className="overflow-hidden border-border/80 bg-card/80 shadow-2xl shadow-background/30">
          <CardHeader className="border-b border-border/80 bg-background/50">
            <div className="flex items-center justify-between"><CardDescription>Demo workflow preview</CardDescription><span className="flex items-center gap-1.5 text-xs text-primary"><span className="size-2 rounded-full bg-primary" /> Live concept</span></div>
            <CardTitle>{isCommerce ? 'Featured collection' : isMission ? 'Supporter journey' : `${mode} service dashboard`}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-3 gap-2">
              {industry.features.slice(0, 3).map((feature, index) => <div key={feature} className="rounded-md border border-border bg-background/60 p-3"><p className="font-mono text-[10px] text-muted-foreground">0{index + 1}</p><p className="mt-2 text-xs font-medium">{feature}</p></div>)}
            </div>
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{isCommerce ? 'Cart conversion' : isMission ? 'People reached' : 'New opportunities'}</span><span className="text-primary">+24.8%</span></div><div className="mt-4 flex items-end gap-1.5" aria-label="Sample performance chart">{[35, 48, 42, 66, 58, 78, 92].map((height, index) => <span key={index} className="flex-1 rounded-t-sm bg-primary/70" style={{ height: `${height}px` }} />)}</div></div>
            <div className="flex items-center gap-3 rounded-md border border-border p-3"><CalendarDays className="size-4 text-primary" aria-hidden="true" /><span className="text-sm">Next best action</span><span className="ml-auto text-xs text-muted-foreground">Automated</span></div>
          </CardContent>
        </Card>
      </section>

      <section className="border-y border-border/80 bg-background/45">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
          {industry.proof.map((item, index) => <div key={item} className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">0{index + 1}</span><div><h2 className="font-medium">{item}</h2><p className="mt-1 text-sm text-muted-foreground">A focused module that can connect to the rest of the customer journey.</p></div></div>)}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <div className="flex flex-col gap-5"><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Built around the workflow</p><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">The pieces that make {industry.name.toLowerCase()} websites work harder.</h2><p className="leading-relaxed text-muted-foreground">This demo is a sales tool, not a template. Each component can be connected to your real forms, CRM, scheduling tools, payment provider, analytics, and internal process.</p><div className="flex flex-col gap-3">{industry.services.map((service) => <div key={service} className="flex items-center gap-3 text-sm"><Check className="size-4 text-primary" aria-hidden="true" />{service}</div>)}</div></div>
        <div className="grid gap-4 sm:grid-cols-2">{industry.features.map((feature, index) => <Card key={feature} className={cn('bg-card/70', index === 0 && 'sm:translate-y-6')}><CardHeader><div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><Zap aria-hidden="true" /></div><CardTitle className="text-lg">{feature}</CardTitle><CardDescription>Designed to make the next step obvious, useful, and easy to measure.</CardDescription></CardHeader></Card>)}</div>
      </section>

      <section id="demo-form" className="border-y border-border/80 bg-card/55">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
          <div className="flex flex-col gap-5"><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Conversion module</p><h2 className="text-3xl font-semibold tracking-tight">{industry.formLabel}</h2><p className="leading-relaxed text-muted-foreground">Try the kind of intake flow we can build for your business. This demo submits no request to an industry company.</p><div className="flex flex-col gap-3 text-sm text-muted-foreground"><span className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> Service area and context</span><span className="flex items-center gap-2"><Clock3 className="size-4 text-primary" /> Fast follow-up workflow</span><span className="flex items-center gap-2"><Phone className="size-4 text-primary" /> Clear handoff to your team</span></div></div>
          <Card><CardContent className="p-6 sm:p-8">{submitted ? <div className="flex flex-col gap-4 py-12 text-center"><Check className="mx-auto size-10 text-primary" /><h3 className="text-xl font-semibold">Demo request captured</h3><p className="text-sm text-muted-foreground">In a production build, this would route to Rooster&apos;s Ridge Digital for a tailored conversation.</p><Button nativeButton={true} variant="outline" onClick={() => setSubmitted(false)}>Try again</Button></div> : <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); setSubmitted(true) }}><div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm font-medium">Name<input required className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Your name" /></label><label className="flex flex-col gap-2 text-sm font-medium">Email<input required type="email" className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="you@company.com" /></label></div><label className="flex flex-col gap-2 text-sm font-medium">What should the system help with?<select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue=""><option value="" disabled>Select a focus area</option>{industry.services.map((service) => <option key={service}>{service}</option>)}</select></label><label className="flex flex-col gap-2 text-sm font-medium">Project context<textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Tell us what you want this workflow to do." /></label>{industry.variant === 'landscaping' || industry.variant === 'roofing' ? <label className="flex flex-col gap-2 text-sm font-medium">Project photos <span className="flex h-10 items-center gap-2 rounded-md border border-dashed border-input px-3 text-sm text-muted-foreground"><Upload className="size-4" /> Upload preview</span></label> : null}<Button type="submit">Explore this workflow <ArrowRight data-icon="inline-end" /></Button></form>}</CardContent></Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="rounded-xl border border-primary/30 bg-primary/10 p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Next step</p><h2 className="mt-2 text-2xl font-semibold">Want this adapted to your business?</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Bring the workflow, content, and tools you already use. We&apos;ll shape the system around the way your business actually works.</p></div><Button render={<Link href="/quote" />} className="mt-5 shrink-0 sm:mt-0">Request a Custom Quote <ArrowRight data-icon="inline-end" /></Button></div></section>
    </div>
  )
}
