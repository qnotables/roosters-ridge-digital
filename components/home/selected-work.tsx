import Link from 'next/link'
import { PortfolioCoverImage } from '@/components/portfolio-cover-image'
import { ArrowUpRight } from 'lucide-react'
import { getPublishedProjects, projectImage } from '@/lib/portfolio'
import { SectionHeading } from '@/components/section-heading'

export async function SelectedWork() {
  const projects = (await getPublishedProjects('work')).slice(0, 3)
  if (projects.length === 0) return null
  return <section className="border-y border-border bg-card/30"><div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20"><SectionHeading eyebrow="Selected work" title="Proof, not promises" description="A few examples of the digital work already built. See the full portfolio for the thinking behind each project." /><div className="mt-10 grid gap-5 md:grid-cols-3">{projects.map((project) => <Link key={project.id} href={`/work/${project.slug}`} className="group flex flex-col overflow-hidden border border-border bg-background"><PortfolioCoverImage src={projectImage(project)} alt={project.cover_image_alt || project.title} sizes="(min-width: 768px) 33vw, 100vw" className="transition-transform duration-500 group-hover:scale-[1.03]" /><div className="flex items-center justify-between gap-3 p-5"><div><p className="text-lg font-semibold">{project.title}</p><p className="mt-1 text-sm text-muted-foreground">{project.short_summary}</p></div><ArrowUpRight className="size-5 shrink-0 text-primary" aria-hidden="true" /></div></Link>)}</div><div className="mt-8"><Link href="/work" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">View My Work<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div></div></section>
}
