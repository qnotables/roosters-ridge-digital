'use client'

import Link from 'next/link'
import { ArrowUpRight, BriefcaseBusiness, Calculator, FileText, Plus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/pricing-shared'
import { leadDisplayName, formatLeadDate } from '@/lib/leads-report-types'

export function AdminOverview({
  data,
}: {
  data: Awaited<ReturnType<typeof import('@/lib/admin-dashboard').getAdminDashboardData>>
}) {
  const { counts, recentLeads, recentEstimates, projects } = data

  return (
    <main className="px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex flex-col justify-between gap-5 border-b border-border pb-7 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Command center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Good to see you.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              One place to manage opportunities, publish proof, price new work, and keep the public site current.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/admin/estimating/new" />}>
              <Plus data-icon="inline-start" /> Create estimate
            </Button>
            <Button variant="outline" render={<Link href="/admin/portfolio" />}>
              Manage portfolio
            </Button>
          </div>
        </header>

        <section aria-label="Dashboard summary" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Total leads"
            value={counts.leads}
            detail={`${counts.quoteLeads} quote requests · ${counts.checkupLeads} checkups`}
            icon={<Users />}
            href="/admin/leads"
          />
          <Metric
            label="Portfolio projects"
            value={counts.projects}
            detail={`${counts.publishedProjects} published · ${counts.draftProjects} drafts`}
            icon={<BriefcaseBusiness />}
            href="/admin/portfolio"
          />
          <Metric
            label="Pricing capabilities"
            value={counts.capabilities}
            detail="Reusable scope and cost assumptions"
            icon={<Calculator />}
            href="/admin/pricing"
          />
          <Metric
            label="Saved estimates"
            value={counts.estimates}
            detail="Latest internal quotes"
            icon={<FileText />}
            href="/admin/estimating"
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Recent inquiries</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">New opportunities ready for review.</p>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/admin/leads" />}>
                View all <ArrowUpRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentLeads.length ? (
                <div className="flex flex-col divide-y divide-border">
                  {recentLeads.map((lead) => (
                    <Link
                      key={String(lead.id)}
                      href="/admin/leads"
                      className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 hover:text-primary"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {leadDisplayName(lead) || lead.business_name || 'Unnamed inquiry'}
                        </p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {lead.email} · {lead.primary_concern || 'General inquiry'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge variant="secondary">
                          {lead.lead_type === 'quote' ? 'Quote' : 'Checkup'}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatLeadDate(lead.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState label="No inquiries yet" href="/admin/leads" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Estimate pipeline</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Your latest saved pricing work.</p>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" render={<Link href="/admin/estimating" />}>
                  View all <ArrowUpRight data-icon="inline-end" />
                </Button>
                <Button variant="ghost" size="sm" render={<Link href="/admin/estimating/new" />}>
                  New <Plus data-icon="inline-end" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentEstimates.length ? (
                <div className="flex flex-col divide-y divide-border">
                  {recentEstimates.map((estimate) => (
                    <Link
                      key={estimate.id}
                      href={`/admin/estimating/${estimate.id}`}
                      className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 hover:text-primary"
                    >
                      <div>
                        <p className="font-medium">
                          {estimate.company || estimate.clientName || 'Unnamed estimate'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {estimate.estimateNumber} · {estimate.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          {formatCurrency(estimate.totalPrice)}
                        </p>
                        {estimate.recurringTotal > 0 && (
                          <p className="text-xs text-muted-foreground">
                            +{formatCurrency(estimate.recurringTotal)}/mo
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState label="No saved estimates yet" href="/admin/estimating/new" />
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Portfolio health</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep your proof library aligned with current work.
                </p>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/admin/portfolio" />}>
                Open CMS <ArrowUpRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href="/admin/portfolio"
                    className="rounded-lg border border-border p-4 hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{project.title}</p>
                      <Badge variant={project.status === 'published' ? 'secondary' : 'outline'}>
                        {project.status}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {project.short_summary || project.primary_category}
                    </p>
                  </Link>
                ))}
              </div>
              {!projects.length && <EmptyState label="Create your first project" href="/admin/portfolio" />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Move from opportunity to delivery without leaving the dashboard.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Action
                href="/admin/leads"
                label="Review leads"
                detail="Triage new opportunities"
                icon={<Users />}
              />
              <Action
                href="/admin/estimating/new"
                label="New estimate"
                detail="Build a custom project quote"
                icon={<Calculator />}
              />
              <Action
                href="/admin/profile"
                label="Update profile"
                detail="Keep public contact details current"
                icon={<BriefcaseBusiness />}
              />
              <Action
                href="/"
                label="Preview public site"
                detail="Check the customer experience"
                icon={<ArrowUpRight />}
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

function Metric({
  label,
  value,
  detail,
  icon,
  href,
}: {
  label: string
  value: number
  detail: string
  icon: React.ReactNode
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
    >
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Link>
  )
}

function Action({
  href,
  label,
  detail,
  icon,
}: {
  href: string
  label: string
  detail: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/50"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </Link>
  )
}

function EmptyState({ label, href }: { label: string; href: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
      {label}.{' '}
      <Link className="text-primary hover:underline" href={href}>
        Open this area
      </Link>
      .
    </div>
  )
}
