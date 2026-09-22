import Link from 'next/link'
import { ArrowRight, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CtaBand } from '@/components/cta-band'
import { SectionHeading } from '@/components/section-heading'
import { getPublishedProjects } from '@/lib/portfolio'
import type { ServicePage } from '@/lib/service-pages'

export async function ServicePageTemplate({ service }: { service: ServicePage }) {
  const projects = (await getPublishedProjects('work')).filter((project) => {
    const categories = [project.primary_category, ...project.additional_categories].join(' ')
    if (service.slug === 'web-design') return /web|site|design|development/i.test(categories)
    if (service.slug === 'automation') return /automation|api|workflow|system|integration/i.test(categories)
    if (service.slug === 'branding') return /brand|creative|graphic|design/i.test(categories)
    if (service.slug === 'custom-solutions') return /platform|custom|application|system/i.test(categories)
    return false
  }).slice(0, 3)
  const Icon = service.icon

  return (
    <>
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-4xl">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon aria-hidden="true" /></div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Rooster Ridge Digital service</p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">{service.h1}</h1>
            <p className="mt-6 max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground">{service.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button render={<Link href={`/quote?service=${service.slug}`} />} size="lg">Start a Project<ArrowRight data-icon="inline-end" /></Button>
              <Button render={<Link href={service.workLink} />} variant="outline" size="lg">{service.workLabel}</Button>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 lg:py-24">
        <section className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <SectionHeading eyebrow="Who this is for" title="Useful help for a real digital problem" description={service.audience} />
          <div className="grid gap-3 sm:grid-cols-2">
            {service.problems.map((problem) => <div key={problem} className="border border-border bg-card p-5"><p className="text-sm leading-relaxed">{problem}</p></div>)}
          </div>
        </section>

        <section className="grid gap-8 border-y border-border py-16 lg:grid-cols-[1fr_.9fr]">
          <div><SectionHeading eyebrow="What is included" title="A focused scope, not a mystery package" description="The exact scope depends on your project, but these are common parts of this service." /></div>
          <ul className="flex flex-col gap-4">{service.included.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-relaxed"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>{item}</span></li>)}</ul>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {service.sections.map((section) => <article key={section.heading} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6"><h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2><p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>{section.items && <ul className="flex flex-wrap gap-2 pt-1">{section.items.map((item) => <li key={item} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">{item}</li>)}</ul>}</article>)}
        </section>

        {projects.length > 0 && <section className="border-t border-border pt-16"><SectionHeading eyebrow="Relevant work" title="See the thinking in practice" description="Explore related projects without repeating the full case study here." /><div className="mt-8 grid gap-4 md:grid-cols-3">{projects.map((project) => <Link key={project.id} href={`/work/${project.slug}`} className="group border border-border bg-card p-5"><p className="font-semibold group-hover:text-primary">{project.title}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{project.short_summary}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">See this project<ExternalLink className="size-4" aria-hidden="true" /></span></Link>)}</div></section>}

        <section className="grid gap-6 border-t border-border pt-16 lg:grid-cols-2"><SectionHeading eyebrow="Questions" title="Before you get started" description="A few practical answers for deciding whether this is the right next step." /><div className="flex flex-col gap-4">{service.faqs.map((faq) => <article key={faq.question} className="border-b border-border pb-4"><h2 className="text-base font-semibold">{faq.question}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p></article>)}</div></section>
      </main>
      <CtaBand title="Have a project in mind?" description="Tell me what you are trying to build, fix, improve, or automate. We can start with the problem and shape the right scope." primaryLabel="Start a Project" secondaryLabel="View All Services" secondaryHref="/services" />
    </>
  )
}
