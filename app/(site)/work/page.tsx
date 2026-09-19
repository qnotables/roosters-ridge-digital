import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CtaBand } from '@/components/cta-band'
import { getPublishedProjects, categoryLabel, designationLabel, projectImage } from '@/lib/portfolio'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteUrl } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Work | Rooster Ridge Digital',
  description: 'Explore websites, digital platforms, automation systems, branding projects, and custom technology work created by Rooster Ridge Digital.',
  alternates: { canonical: `${siteUrl}/work` },
  openGraph: { url: `${siteUrl}/work`, images: [ogMetadata('work')] },
  twitter: { card: 'summary_large_image', images: [twitterImage('work')] },
}

type Project = Awaited<ReturnType<typeof getPublishedProjects>>[number]

function ProjectSection({ project, index }: { project: Project; index: number }) {
  const reversed = index % 2 === 1
  return (
    <article className="grid overflow-hidden border border-border bg-card lg:grid-cols-2">
      <Link href={`/work/${project.slug}`} className={`group relative block min-h-72 overflow-hidden bg-muted lg:min-h-[30rem] ${reversed ? 'lg:order-2' : ''}`}>
        <Image src={projectImage(project)} alt={project.cover_image_alt || project.title} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        <span className="absolute left-5 top-5 rounded-full border border-border/70 bg-background/85 px-3 py-1 text-xs font-medium backdrop-blur">{String(index + 1).padStart(2, '0')}</span>
      </Link>
      <div className={`flex flex-col justify-center gap-5 p-6 sm:p-9 lg:p-12 ${reversed ? 'lg:order-1' : ''}`}>
        <div className="flex flex-wrap gap-2"><Badge variant="outline">{designationLabel(project.designation)}</Badge><Badge variant="secondary">{categoryLabel(project.primary_category)}</Badge></div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.title}</h2>
        <p className="text-base leading-relaxed text-muted-foreground">{project.short_summary}</p>
        <div className="flex flex-col gap-4 border-y border-border py-5 text-sm">
          <div><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">The project</h3><p className="mt-1 leading-relaxed">{project.challenge || 'A focused digital project shaped around a real business need.'}</p></div>
          <div><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What was built</h3><p className="mt-1 leading-relaxed">{project.creative_approach || project.deliverables.join(', ') || 'A practical digital experience designed for the people who use it.'}</p></div>
        </div>
        {project.deliverables.length > 0 && <div className="flex flex-wrap gap-2">{project.deliverables.slice(0, 6).map((item) => <span key={item} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3 text-primary" aria-hidden="true" />{item}</span>)}</div>}
        <Button render={<Link href={`/work/${project.slug}`} />} variant="outline" className="w-fit">Read the project<ArrowRight data-icon="inline-end" /></Button>
      </div>
    </article>
  )
}

export default async function WorkPage() {
  const projects = await getPublishedProjects('work')
  return (
    <>
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Selected work</p>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Built. Shipped. Working.</h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">A selection of websites, platforms, digital systems, branding projects, and technical solutions built by Rooster Ridge Digital.</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        {projects.length > 0 ? <div className="flex flex-col gap-8">{projects.map((project, index) => <ProjectSection key={project.id} project={project} index={index} />)}</div> : <div className="flex flex-col items-center gap-5 border border-dashed border-border bg-card/50 px-6 py-16 text-center"><Sparkles className="size-7 text-primary" aria-hidden="true" /><h2 className="text-xl font-semibold">Case studies are being prepared</h2><p className="max-w-lg text-muted-foreground">Real projects are being documented here now. We would rather publish verifiable work than fill this page with fabricated results.</p><Button render={<Link href="/quote" />}>Start a Project<ArrowRight data-icon="inline-end" /></Button></div>}
      </section>
      <CtaBand title="Need something like this built?" description="Tell me what you are trying to build, fix, or improve. We can start with the problem and work toward the right solution." primaryLabel="Start a Project" secondaryLabel="View Services" secondaryHref="/services" />
    </>
  )
}
