'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Eye,
  Copy,
  Trash2,
  FileText,
  DollarSign,
  ArrowUpRight,
  ExternalLink,
  Edit,
  Clock,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmailEstimateButton } from '@/components/admin/email-estimate-button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, type EstimateStatus } from '@/lib/pricing-shared'
import { duplicateEstimateAction, deleteEstimateAction, updateEstimateStatusAction } from '@/app/actions/pricing'

export type EstimateListItem = {
  id: string
  estimateNumber: string
  clientName: string
  company: string
  email: string
  projectName: string
  industrySlug: string
  status: EstimateStatus
  totalPrice: number
  recurringTotal: number
  depositAmount: number
  createdAt: string
  updatedAt?: string
}

export function EstimatesManager({
  estimates: initialEstimates,
}: {
  estimates: EstimateListItem[]
}) {
  const router = useRouter()
  const [estimates, setEstimates] = useState<EstimateListItem[]>(initialEstimates)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const filtered = estimates.filter((est) => {
    const text = `${est.estimateNumber} ${est.clientName} ${est.company} ${est.email} ${est.projectName}`.toLowerCase()
    const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'All' || est.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Pipeline stats
  const totalValue = estimates.reduce((sum, e) => sum + e.totalPrice, 0)
  const acceptedValue = estimates
    .filter((e) => e.status === 'Accepted')
    .reduce((sum, e) => sum + e.totalPrice, 0)
  const pendingCount = estimates.filter(
    (e) => e.status === 'Draft' || e.status === 'Ready to Review' || e.status === 'Sent'
  ).length

  async function handleDuplicate(id: string) {
    setActionLoadingId(id)
    try {
      const res = await duplicateEstimateAction(id)
      toast.success(`Estimate duplicated to ${res.estimateNumber}`)
      router.push(`/admin/estimating/${res.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not duplicate estimate.')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDelete(id: string, num: string) {
    if (!window.confirm(`Are you sure you want to delete estimate ${num}?`)) return
    setActionLoadingId(id)
    try {
      await deleteEstimateAction(id)
      setEstimates((cur) => cur.filter((e) => e.id !== id))
      toast.success(`Estimate ${num} deleted.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete estimate.')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleStatusChange(id: string, newStatus: EstimateStatus) {
    try {
      await updateEstimateStatusAction(id, newStatus)
      setEstimates((cur) =>
        cur.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
      )
      toast.success(`Status updated to ${newStatus}`)
    } catch (err) {
      toast.error('Could not update status.')
    }
  }

  function getStatusBadge(status: EstimateStatus) {
    switch (status) {
      case 'Accepted':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Accepted</Badge>
      case 'Ready to Review':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Ready to Review</Badge>
      case 'Sent':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Sent</Badge>
      case 'Negotiating':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Negotiating</Badge>
      case 'Declined':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Declined</Badge>
      case 'Expired':
        return <Badge className="bg-muted text-muted-foreground">Expired</Badge>
      default:
        return <Badge variant="outline">Draft</Badge>
    }
  }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Internal Quoting System
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Project Estimates
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage quotes, review drafts, export customer PDFs, and track proposal velocity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" render={<Link href="/admin/pricing" />}>
              Pricing Matrix
            </Button>
            <Button render={<Link href="/admin/estimating/new" />} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus data-icon="inline-start" className="size-4" /> New Estimate
            </Button>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Pipeline</CardTitle>
              <DollarSign className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              <p className="text-[11px] text-muted-foreground">{estimates.length} total quotes tracked</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Accepted Work</CardTitle>
              <DollarSign className="size-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(acceptedValue)}</p>
              <p className="text-[11px] text-muted-foreground">
                {estimates.filter((e) => e.status === 'Accepted').length} converted deals
              </p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Active Pipeline</CardTitle>
              <Clock className="size-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-[11px] text-muted-foreground">Drafts & quotes in review</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Avg Estimate Size</CardTitle>
              <FileText className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {estimates.length ? formatCurrency(totalValue / estimates.length) : '$0'}
              </p>
              <p className="text-[11px] text-muted-foreground">Per generated quote</p>
            </CardContent>
          </Card>
        </section>

        {/* Filter and Search Bar */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, company, estimate number…"
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['All', 'Draft', 'Ready to Review', 'Sent', 'Negotiating', 'Accepted', 'Declined'].map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
        </div>

        {/* Estimates Table */}
        <section className="mt-4 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Estimate / Client</th>
                  <th className="px-4 py-3">Project Title</th>
                  <th className="px-4 py-3 text-right">One-Time Total</th>
                  <th className="px-4 py-3 text-right">Recurring / Mo</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filtered.map((est) => (
                  <tr key={est.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/admin/estimating/${est.id}`}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        {est.company || est.clientName || 'Unnamed Estimate'}
                        <Edit className="size-3 opacity-60" />
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono text-xs text-primary">{est.estimateNumber}</span>
                        {est.clientName && est.company && <span>• {est.clientName}</span>}
                        {est.email && <span>• {est.email}</span>}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-medium">{est.projectName || 'Custom Digital Solution'}</p>
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-sm">
                      {formatCurrency(est.totalPrice)}
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">
                      {est.recurringTotal > 0 ? `${formatCurrency(est.recurringTotal)}/mo` : '—'}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <select
                        value={est.status}
                        onChange={(e) => handleStatusChange(est.id, e.target.value as EstimateStatus)}
                        className="h-7 rounded border border-input bg-background px-2 text-[11px] font-semibold text-foreground"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Ready to Review">Ready to Review</option>
                        <option value="Sent">Sent</option>
                        <option value="Negotiating">Negotiating</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Declined">Declined</option>
                        <option value="Expired">Expired</option>
                      </select>
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground">
                      {new Date(est.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EmailEstimateButton estimateId={est.id} />
                        <Button
                          variant="ghost"
                          size="icon"
                          render={<Link href={`/admin/estimating/${est.id}`} />}
                          title="Edit estimate"
                          aria-label="Edit estimate"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          render={<Link href={`/admin/estimating/${est.id}/preview`} target="_blank" />}
                          title="Preview / Print Customer PDF"
                          aria-label="Preview customer PDF"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(est.id)}
                          disabled={actionLoadingId === est.id}
                          title="Duplicate estimate"
                          aria-label="Duplicate estimate"
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(est.id, est.estimateNumber)}
                          disabled={actionLoadingId === est.id}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete estimate"
                          aria-label="Delete estimate"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold text-foreground">No estimates found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {estimates.length === 0
                  ? 'Create your first project estimate to start quoting clients.'
                  : 'No estimates match your search or status filter.'}
              </p>
              <Button
                render={<Link href="/admin/estimating/new" />}
                className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                size="sm"
              >
                <Plus data-icon="inline-start" className="size-4" /> Create Estimate
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
