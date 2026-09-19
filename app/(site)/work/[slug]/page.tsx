import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CtaBand } from '@/components/cta-band'
import { getPublishedProject, getPublishedProjects, categoryLabel, designationLabel, projectImage } from '@/lib/portfolio'
import { siteConfig, siteUrl } from '@/lib/site-config'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await getPublishedProject(slug)
  if (!project) return { title: 'Project not found', robots: { index: false, follow: false } }
  const title = project.seo_title || `${project.title} — ${siteConfig.name}`
  const description = project.meta_description || project.short_summary
  const socialTitle = project.social_sharing_title || title
  const socialDescription = project.social_sharing_description || description
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/work/${project.slug}` },
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      url: `${siteUrl}/work/${project.slug}`,
      type: 'article',
      images: [{ url: projectImage(project), alt: project.cover_image_alt || project.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: socialDescription,
      images: [projectImage(project)],
    },
  }
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const [project, all] = await Promise.all([getPublishedProject(slug), getPublishedProjects('work')])
  if (!project) notFound()
  const index = all.findIndex((item) => item.slug === project.slug)
  const previous = index > 0 ? all[index - 1] : null
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    description: project.short_summary,
    url: `${siteUrl}/work/${project.slug}`,
    image: projectImage(project),
    dateCreated: project.project_date || undefined,
    genre: categoryLabel(project.primary_category),
    creator: { '@id': `${siteUrl}/#organization` },
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <article>
      <header className="border-b border-border bg-card/40"><div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20"><div className="flex flex-col gap-5"><Link href="/work" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft data-icon="inline-start" />Back to Work</Link><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{designationLabel(project.designation)}</Badge><Badge variant="secondary">{categoryLabel(project.primary_category)}</Badge></div><h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">{project.title}</h1><p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{project.short_summary}</p>{project.designation === 'concept' && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">An original demonstration project created to show the design approach, deliverables, and level of finish available through Rooster&apos;s Ridge Digital.</p>}</div></div></header>
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.7fr)] lg:py-16"><div className="flex flex-col gap-12"><div className="relative aspect-[16/10] overflow-hidden border border-border bg-card"><Image src={projectImage(project)} alt={project.cover_image_alt || project.title} fill priority sizes="(min-width: 1024px) 66vw, 100vw" className="object-cover" /></div><div className="grid gap-10 md:grid-cols-2"><section className="flex flex-col gap-3"><h2 className="text-xl font-semibold">The challenge</h2>{project.challenge && <p className="leading-relaxed text-muted-foreground">{project.challenge}</p>}</section><section className="flex flex-col gap-3"><h2 className="text-xl font-semibold">Creative approach</h2>{project.creative_approach && <p className="leading-relaxed text-muted-foreground">{project.creative_approach}</p>}</section></div>{project.gallery.length > 0 && <section className="flex flex-col gap-5"><h2 className="text-xl font-semibold">More from this project</h2><div className="grid gap-5 sm:grid-cols-2">{project.gallery.map((image) => <div key={image.url} className="relative aspect-square overflow-hidden border border-border"><Image src={image.url} alt={image.alt} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" /></div>)}</div></section>}</div><aside className="flex h-fit flex-col gap-8 border-l border-border pl-6"><div className="flex flex-col gap-2"><h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Project details</h2>{project.client_type && <p className="text-sm"><span className="text-muted-foreground">Client type: </span>{project.client_type}</p>}{project.show_client_name && project.client_name && <p className="text-sm"><span className="text-muted-foreground">Client: </span>{project.client_name}</p>}</div>{project.deliverables.length > 0 && <div className="flex flex-col gap-3"><h2 className="font-semibold">Deliverables</h2><ul className="flex flex-col gap-2 text-sm text-muted-foreground">{project.deliverables.map((item) => <li key={item}>— {item}</li>)}</ul></div>}{(project.intended_purpose || project.verified_outcome) && <div className="flex flex-col gap-3"><h2 className="font-semibold">{project.verified_outcome ? 'Verified outcome' : 'Intended purpose'}</h2><p className="text-sm leading-relaxed text-muted-foreground">{project.verified_outcome || project.intended_purpose}</p></div>}<Button render={<Link href="/quote" />}>Discuss a project<ArrowRight data-icon="inline-end" /></Button></aside></div>
    </article>
    {(previous || next) && <nav className="border-t border-border" aria-label="Project navigation"><div className="mx-auto flex max-w-6xl justify-between gap-6 px-4 py-8 sm:px-6">{previous ? <Link href={`/work/${previous.slug}`} className="flex max-w-[45%] flex-col gap-1 text-sm hover:text-primary"><span className="text-muted-foreground">Previous</span><span className="font-semibold">{previous.title}</span></Link> : <span />}{next && <Link href={`/work/${next.slug}`} className="flex max-w-[45%] flex-col items-end gap-1 text-right text-sm hover:text-primary"><span className="text-muted-foreground">Next</span><span className="font-semibold">{next.title}</span></Link>}</div></nav>}
    <CtaBand title="Have a project in mind?" primaryLabel={siteConfig.cta.start} />
  </>
}
