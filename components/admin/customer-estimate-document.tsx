'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Printer, Download, ArrowLeft, CheckCircle2, ShieldCheck, Calendar, Clock, DollarSign, Mail, Phone, MapPin, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatCurrencyPrecise, getEstimateFilename, type EstimateRecord } from '@/lib/pricing-shared'
import type { BusinessProfile } from '@/lib/business-profile'

export function CustomerEstimateDocument({
  estimate,
  profile,
  showControls = true,
}: {
  estimate: EstimateRecord
  profile: BusinessProfile
  showControls?: boolean
}) {
  const [mounted, setMounted] = useState(false)
  const clientIdentifier = estimate.company || estimate.clientName || 'Client'
  const pdfTitle = getEstimateFilename(estimate.estimateNumber, clientIdentifier)

  useEffect(() => {
    setMounted(true)
    const originalTitle = document.title
    document.title = pdfTitle.replace(/\.pdf$/i, '')
    return () => {
      document.title = originalTitle
    }
  }, [pdfTitle])

  function handlePrint() {
    window.print()
  }

  const creationDateFormatted = estimate.createdAt
    ? new Date(estimate.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })

  const expirationDateFormatted = (() => {
    if (!estimate.expirationDate) return '30 days from issue'
    const dateStr = String(estimate.expirationDate).trim()
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return '30 days from issue'
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  })()

  // Included vs Quoted item separation
  const includedItems = estimate.items.filter((item) => item.isIncluded)
  const quotedItems = estimate.items.filter((item) => !item.isIncluded)

  return (
    <div className="estimate-document-wrapper min-h-screen bg-slate-100 py-6 text-slate-900 print:bg-white print:p-0 print:py-0">
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.55in;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-table thead {
            display: table-header-group !important;
          }
          .print-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .estimate-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Floating / Sticky Control Bar */}
      {showControls && (
        <div className="no-print mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" render={<Link href={`/admin/estimating/${estimate.id}`} />}>
              <ArrowLeft data-icon="inline-start" className="size-4" /> Back to Builder
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer View</p>
              <p className="text-sm font-semibold text-slate-900">{estimate.estimateNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} className="bg-orange-600 text-white hover:bg-orange-700">
              <Printer data-icon="inline-start" className="size-4" /> Print / Save as PDF
            </Button>
          </div>
        </div>
      )}

      {/* Main Printable Document Sheet */}
      <div className="estimate-sheet mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl sm:p-12 print:p-0 print:shadow-none">
        {/* Document Header */}
        <header className="border-b-2 border-orange-500 pb-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-slate-950 font-bold text-orange-500 shadow-sm">
                  RR
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-950">Rooster&apos;s Ridge Digital</h1>
                  <p className="text-xs font-medium text-slate-500">Digital Strategy • Modern Web Systems • Operations</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-1 text-xs text-slate-600">
                <p className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-orange-600" />
                  <span>{profile.email || 'rooster@roostersridgedigital.com'}</span>
                </p>
                {profile.phone && profile.show_phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-orange-600" />
                    <span>{profile.phone}</span>
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-orange-600" />
                  <span>{profile.location || 'Serving businesses nationwide'}</span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 text-right sm:min-w-[260px] print:bg-slate-50">
              <span className="inline-block rounded-md bg-orange-100 px-2.5 py-1 text-xs font-bold tracking-wider text-orange-800">
                PROJECT ESTIMATE
              </span>
              <p className="mt-3 text-lg font-mono font-bold tracking-tight text-slate-900">{estimate.estimateNumber}</p>
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <p className="flex justify-between gap-4">
                  <span className="text-slate-500">Issue Date:</span>
                  <span className="font-medium text-slate-900">{creationDateFormatted}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-slate-500">Valid Through:</span>
                  <span className="font-medium text-slate-900">{expirationDateFormatted}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Client & Project Details Band */}
          <div className="mt-8 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Prepared For</p>
              <p className="mt-1 text-base font-bold text-slate-950">{estimate.clientName || 'Valued Client'}</p>
              {estimate.company && <p className="text-sm font-medium text-slate-700">{estimate.company}</p>}
              {estimate.email && <p className="text-xs text-slate-600">{estimate.email}</p>}
              {estimate.phone && <p className="text-xs text-slate-600">{estimate.phone}</p>}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Project Name</p>
              <p className="mt-1 text-base font-bold text-slate-950">{estimate.projectName || 'Custom Digital Solution'}</p>
              <p className="text-xs text-slate-600">
                Primary Architecture:{' '}
                <span className="font-semibold text-slate-900">{estimate.platformName || 'Base Platform'}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Project Overview */}
        {estimate.projectOverview && (
          <section className="print-break-inside-avoid mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-orange-700">Project Overview & Objectives</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {estimate.projectOverview}
            </p>
          </section>
        )}

        {/* Base Platform & Included Scope */}
        <section className="print-break-inside-avoid mt-8 rounded-xl border border-slate-200 bg-slate-50/40 p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Core Platform</span>
              <h3 className="text-lg font-bold text-slate-900">{estimate.platformName || 'Base Solution'}</h3>
            </div>
            <p className="text-base font-mono font-bold text-slate-950">
              {formatCurrency(estimate.platformPrice || estimate.basePrice)}
            </p>
          </div>

          {/* Included Features with this Platform */}
          {includedItems.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-700">
                Included Features at No Additional Charge:
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {includedItems.map((item) => (
                  <div key={item.id || item.label} className="flex items-start gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    <div>
                      <span className="font-semibold text-slate-900">{item.label}</span>
                      {item.description && <span className="text-slate-500"> — {item.description}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Itemized Additional Scope & Custom Features Table */}
        <section className="print-break-inside-avoid mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-orange-700">Itemized Project Scope</h2>
            <p className="text-xs text-slate-500">Transparent line-item breakdown</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="print-table w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100 font-semibold uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="px-4 py-3">Feature / Capability</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-3 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {/* Platform row */}
                <tr className="bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-950">
                    {estimate.platformName || 'Base Platform Architecture'}
                    <span className="block text-[11px] font-normal text-slate-500">
                      Core foundation, responsive layout, performance baseline, and initial setup.
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">Platform Core</td>
                  <td className="px-3 py-3 text-center">1</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(estimate.platformPrice || estimate.basePrice)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-950">
                    {formatCurrency(estimate.platformPrice || estimate.basePrice)}
                  </td>
                </tr>

                {/* Quoted and Custom Items */}
                {quotedItems.map((item) => {
                  const unitPrice = item.manualPriceOverride ?? item.unitPrice
                  const total = Math.max(0, unitPrice * item.quantity - (item.discount || 0))
                  return (
                    <tr key={item.id || item.label}>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-950">{item.label}</span>
                        {item.clientNote ? (
                          <span className="block text-[11px] text-slate-600">{item.clientNote}</span>
                        ) : item.description ? (
                          <span className="block text-[11px] text-slate-500">{item.description}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.category || 'Feature'}</td>
                      <td className="px-3 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurrency(unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-950">{formatCurrency(total)}</td>
                    </tr>
                  )
                })}

                {/* Included Items Listed in Table with $0 */}
                {includedItems.map((item) => (
                  <tr key={`inc-${item.id || item.label}`} className="bg-emerald-50/30 text-slate-600">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900">{item.label}</span>
                      <span className="ml-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        Included with Platform
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{item.category || 'Core'}</td>
                    <td className="px-3 py-2.5 text-center">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-700">INCLUDED</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-700">$0.00</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Financial Summary & Deposit Breakdown */}
        <section className="print-break-inside-avoid mt-8 grid gap-6 md:grid-cols-2">
          {/* Deposit & Schedule (Left) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-700">Project Terms & Investment</h3>
            <div className="mt-4 space-y-3 text-xs">
              {estimate.depositAmount > 0 ? (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/70 p-3">
                    <div>
                      <p className="font-bold text-orange-900">
                        Initial Deposit Required{' '}
                        {estimate.depositType === 'percent' && `(${estimate.depositValue}%)`}
                      </p>
                      <p className="text-[11px] text-orange-700">Due upon agreement to commence project sprints</p>
                    </div>
                    <p className="font-mono text-base font-bold text-orange-900">
                      {formatCurrency(estimate.depositAmount)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <span className="text-slate-600">Remaining Balance (Upon Launch):</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(estimate.remainingBalance)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">
                  <p className="font-medium text-slate-900">Payment Milestones</p>
                  <p className="mt-1 text-[11px]">
                    Standard terms: 50% deposit upon kickoff, balance due upon client approval and launch.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* One-Time Project Total (Right) */}
          <div className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">One-Time Project Investment</h3>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Platform Foundation:</span>
                <span className="font-mono">{formatCurrency(estimate.platformPrice || estimate.basePrice)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Features & Custom Items:</span>
                <span className="font-mono">{formatCurrency(estimate.capabilitySubtotal)}</span>
              </div>
              {estimate.customLabor > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Custom Engineering & Labor:</span>
                  <span className="font-mono">{formatCurrency(estimate.customLabor)}</span>
                </div>
              )}
              {estimate.complexityAdjustment > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Architecture & Integration Scope:</span>
                  <span className="font-mono">+{formatCurrency(estimate.complexityAdjustment)}</span>
                </div>
              )}
              {estimate.contingency > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Project Contingency:</span>
                  <span className="font-mono">+{formatCurrency(estimate.contingency)}</span>
                </div>
              )}
              {estimate.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>
                    Project Discount {estimate.discountType === 'percent' && `(${estimate.discountValue}%)`}:
                  </span>
                  <span className="font-mono">−{formatCurrency(estimate.discount)}</span>
                </div>
              )}
              {estimate.taxEnabled && estimate.tax > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Applicable Tax ({estimate.taxRate}%):</span>
                  <span className="font-mono">{formatCurrency(estimate.tax)}</span>
                </div>
              )}
              <div className="mt-4 flex items-baseline justify-between border-t border-slate-800 pt-3">
                <span className="text-sm font-bold text-white">Total Project Estimate:</span>
                <span className="font-mono text-2xl font-bold text-orange-400">
                  {formatCurrency(estimate.totalPrice)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Recurring Services Section (Optional ongoing care) */}
        {estimate.recurringItems && estimate.recurringItems.length > 0 && (
          <section className="print-break-inside-avoid mt-8 rounded-xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-orange-700">
                  Ongoing Support & Maintenance Plans (Optional)
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Proactive care, security patches, backups, and retained hours to protect your investment.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Total Recurring:</span>
                <p className="font-mono text-base font-bold text-slate-900">
                  {formatCurrency(estimate.recurringTotal)} / month
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {estimate.recurringItems.map((item) => (
                <div key={item.id || item.name} className="flex items-center justify-between gap-4 p-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.includedHours > 0 ? `${item.includedHours} monthly support hours included` : 'Continuous monitoring & updates'}{' '}
                      • {item.billingFrequency}
                    </p>
                  </div>
                  <p className="font-mono font-semibold text-slate-950">
                    {formatCurrency(item.monthlyClientPrice)} / mo
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Assumptions & Exclusions */}
        {(estimate.assumptions || estimate.exclusions) && (
          <section className="print-break-inside-avoid mt-8 grid gap-6 sm:grid-cols-2">
            {estimate.assumptions && (
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-700">Project Assumptions</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                  {estimate.assumptions}
                </p>
              </div>
            )}
            {estimate.exclusions && (
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-700">Scope Exclusions</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                  {estimate.exclusions}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Timeline & Next Steps */}
        {(estimate.timeline || estimate.nextSteps) && (
          <section className="print-break-inside-avoid mt-8 grid gap-6 sm:grid-cols-2">
            {estimate.timeline && (
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-700">Estimated Timeline</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                  {estimate.timeline}
                </p>
              </div>
            )}
            {estimate.nextSteps && (
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-700">Next Steps & Approval</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                  {estimate.nextSteps}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Document Footer Disclaimer */}
        <footer className="mt-10 border-t border-slate-200 pt-6 text-[11px] leading-relaxed text-slate-500">
          <p className="font-semibold text-slate-700">
            Document Notice & Pricing Validity:
          </p>
          <p className="mt-1">
            This document is a formal project estimate prepared by Rooster&apos;s Ridge Digital and does not constitute a final tax invoice or binding contract. The scope, pricing, and timeline estimates outlined herein remain valid through{' '}
            <span className="font-semibold text-slate-700">{expirationDateFormatted}</span>. Final terms and scheduling are confirmed upon mutual agreement and deposit submission.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[10px] text-slate-400">
            <span>Rooster&apos;s Ridge Digital • {profile.email || 'rooster@roostersridgedigital.com'}</span>
            <span>Estimate Reference: {estimate.estimateNumber}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
