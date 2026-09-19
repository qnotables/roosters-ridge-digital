import type { LucideIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  Check,
  Code2,
  Compass,
  Layers3,
  Lightbulb,
  Mail,
  Palette,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteConfig, siteUrl } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'About | Rooster Ridge Digital',
  description:
    'Learn about Rooster Ridge Digital, an independent digital studio providing web design, automation, AI tools, branding, digital strategy, and custom technology solutions for businesses and organizations.',
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    title: `About | ${siteConfig.name}`,
    description: 'Practical digital solutions for real businesses.',
    url: `${siteUrl}/about`,
    images: [ogMetadata('about')],
  },
  twitter: { card: 'summary_large_image', images: [twitterImage('about')] },
}

const services: { title: string; description: string; icon: LucideIcon }[] = [
  { title: 'Web Design & Development', description: 'Modern, responsive websites built around usability, performance, and clear business goals.', icon: Code2 },
  { title: 'AI & Automation', description: 'Practical AI tools and automated workflows that reduce repetitive work and improve efficiency.', icon: Bot },
  { title: 'Digital Strategy', description: 'Help choosing platforms, tools, systems, and workflows that actually fit the business.', icon: Compass },
  { title: 'Branding & Creative', description: 'Digital branding, graphics, marketing assets, and visual systems that create a consistent identity.', icon: Palette },
  { title: 'Troubleshooting & Optimization', description: 'Diagnosing broken websites, confusing workflows, poor performance, integrations, and technical issues.', icon: Wrench },
  { title: 'Custom Digital Projects', description: 'Unique solutions for projects that do not fit neatly into a standard service package.', icon: Layers3 },
]

const audiences = ['Small Businesses', 'Entrepreneurs', 'Startups', 'Nonprofits', 'Content Creators', 'Local Businesses', 'Remote Clients', 'Independent Professionals']
const trustPoints = ['Direct Communication', 'Flexible Solutions', 'Practical Technology', 'Independent Thinking']
const capabilities = {
  'Web & Development': ['Next.js', 'React', 'Vercel', 'WordPress', 'Wix', 'Shopify', 'HTML / CSS'],
  'Business & Data': ['Excel', 'Power BI', 'QuickBooks', 'SQL', 'Analytics', 'Reporting'],
  'Automation & AI': ['AI Workflows', 'API Integrations', 'Webhooks', 'Email Automation', 'Lead Funnels', 'Process Automation'],
  Creative: ['Branding', 'Social Graphics', 'Digital Content', 'Marketing Assets', 'UI / UX'],
}

const approach = [
  ['01', 'Understand', 'Start with the actual problem, goal, or opportunity.'],
  ['02', 'Simplify', 'Remove unnecessary complexity and identify the most practical solution.'],
  ['03', 'Build', 'Create the system, website, workflow, design, or integration.'],
  ['04', 'Improve', 'Test, refine, optimize, and make sure the final product works in the real world.'],
]

export default function AboutPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative isolate border-b border-border bg-[#101a2b]">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_45%,rgba(220,150,45,0.18),transparent_30%),linear-gradient(90deg,#101a2b_0%,rgba(16,26,43,0.92)_35%,rgba(16,26,43,0.3)_70%,#101a2b_100%)]" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:min-h-[650px] lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16 lg:px-8">
          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Rooster Ridge Digital</p>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">Digital Solutions Built for Real Businesses.</h1>
            <p className="mt-6 text-pretty text-lg leading-8 text-muted-foreground">Rooster Ridge Digital helps businesses, organizations, creators, and entrepreneurs improve their online presence through practical web design, automation, digital strategy, branding, AI-powered tools, and custom technology solutions.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button render={<Link href="/quote" />} size="lg">Start a Project <ArrowRight data-icon="inline-end" /></Button>
              <Button render={<Link href="/services" />} size="lg" variant="outline">Explore Services</Button>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden border border-white/15 bg-card shadow-2xl shadow-black/30 lg:aspect-[1.18/1]">
            <Image src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-iA8A2K6EcH12fc4fuezDWoGIIWnwHt.png" alt="Warm dark digital studio workspace with a laptop, analytics monitor, phone, notebooks, and mountain views." fill priority sizes="(max-width: 1023px) 100vw, 60vw" className="object-cover object-center" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#101a2b]/40 via-transparent to-primary/10" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The studio</p><h2 className="mt-4 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">Built From Experience. Focused on Solutions.</h2></div>
        <div className="max-w-3xl space-y-6 text-lg leading-8 text-muted-foreground"><p>Rooster Ridge Digital was created around a simple idea: technology should solve problems, not create more of them.</p><p>I work with businesses, organizations, entrepreneurs, and individuals who need practical digital solutions without the unnecessary complexity of a large agency.</p><p>That may mean building a new website, improving an existing one, automating repetitive work, creating a better lead system, developing a digital brand, integrating AI tools, troubleshooting technical problems, or simply figuring out what technology actually makes sense for the business.</p><p>Every project starts with understanding the problem first and choosing the right tools second.</p></div>
      </section>

      <section className="border-y border-border bg-card/35">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Capabilities</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">What Rooster Ridge Digital Does</h2></div><div className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">{services.map(({ title, description, icon: Icon }) => <article key={title} className="bg-background p-7 transition-colors hover:bg-secondary/50"><Icon className="size-7 text-primary" aria-hidden="true" /><h3 className="mt-8 text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-muted-foreground">{description}</p></article>)}</div></div>
      </section>

      <section className="relative overflow-hidden bg-[#111a2b] text-foreground"><div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49.9%,rgba(255,255,255,0.04)_50%,transparent_50.1%)] bg-[size:25%_100%]" aria-hidden="true" /><div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The process</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">How I Work</h2></div><div className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">{approach.map(([number, title, description], index) => <div key={number} className="relative"><div className="flex items-center gap-4"><span className="font-mono text-sm text-primary">{number}</span><div className="h-px flex-1 bg-primary/40 md:hidden" aria-hidden="true" /></div><div className="mt-5"><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-muted-foreground">{description}</p></div>{index < approach.length - 1 && <div className="absolute left-[calc(100%+0.75rem)] top-3 hidden h-px w-[calc(100%-1.5rem)] bg-primary/30 md:block" aria-hidden="true" />}</div>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"><div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Who it is for</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Built for People Who Need Things to Work.</h2></div><p className="max-w-xl leading-8 text-muted-foreground">Rooster Ridge Digital works remotely, so location is rarely a limitation. Projects can be completed for clients locally or across the country.</p></div><div className="mt-10 flex flex-wrap gap-3">{audiences.map((audience) => <span key={audience} className="border border-border bg-card px-4 py-2.5 text-sm text-foreground">{audience}</span>)}</div></section>

      <section className="border-y border-border bg-card/40"><div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:px-8"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The difference</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">No Agency Runaround.</h2></div><div><p className="max-w-2xl text-xl leading-9 text-foreground">Working with Rooster Ridge Digital means working directly with the person solving the problem.</p><p className="mt-6 max-w-2xl leading-8 text-muted-foreground">There are no layers of account managers, unnecessary meetings, or inflated processes. The focus is clear communication, practical recommendations, transparent work, and building something that actually helps the client accomplish their goal.</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{trustPoints.map((point) => <div key={point} className="flex items-center gap-3 border-t border-border pt-4 text-sm font-medium"><Check className="size-4 text-primary" aria-hidden="true" />{point}</div>)}</div></div></div></section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Technical range</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Tools, Platforms &amp; Capabilities</h2><p className="mt-4 leading-7 text-muted-foreground">A practical toolkit for choosing the right path—not a résumé of every tool available.</p></div><div className="mt-12 grid gap-8 md:grid-cols-2">{Object.entries(capabilities).map(([category, items]) => <div key={category} className="border-l-2 border-primary/50 pl-5"><h3 className="font-semibold">{category}</h3><div className="mt-4 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">{item}</span>)}</div></div>)}</div></section>

      <section className="border-y border-border bg-[#111a2b] px-4 py-24 text-center sm:px-6 sm:py-32"><Lightbulb className="mx-auto size-8 text-primary" aria-hidden="true" /><p className="mx-auto mt-8 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Good technology should make a business easier to run, easier to understand, or easier to grow.</p><p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">If it does none of those things, it probably does not belong in the solution.</p></section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"><div className="border border-primary/30 bg-primary/10 p-8 sm:p-12 lg:flex lg:items-end lg:justify-between lg:gap-12"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Start a conversation</p><h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">Have a Digital Problem That Needs Solved?</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Whether you need a website, automation, a better workflow, a digital strategy, or help figuring out what comes next, Rooster Ridge Digital can help.</p></div><div className="mt-8 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col"><Button render={<Link href="/quote" />} size="lg">Start a Project <ArrowRight data-icon="inline-end" /></Button><Button render={<Link href="/services" />} size="lg" variant="outline">View Services</Button></div></div><div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Mail className="size-4 text-primary" aria-hidden="true" />Prefer email? Use the contact details in the site footer to get started.</div></section>
    </div>
  )
}
