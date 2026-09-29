'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  Check,
  Search,
  Plus,
  Trash2,
  Copy,
  Printer,
  Eye,
  AlertTriangle,
  Info,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  ArrowLeft,
  FileCheck,
  X,
  ExternalLink,
  Percent,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { createEstimate, updateEstimate, duplicateEstimateAction } from '@/app/actions/pricing'
import {
  formatCurrency,
  formatCurrencyPrecise,
  pricingIndustries,
  suggestedCapabilities,
  isCapabilityIncludedInPlatform,
  detectOverlappingCapabilities,
  calculateEstimateTotals,
  getEstimateFilename,
  DEFAULT_OVERVIEW,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_EXCLUSIONS,
  DEFAULT_TIMELINE,
  DEFAULT_NEXT_STEPS,
  type PricingCapability,
  type PricingPlatform,
  type RecurringService,
  type EstimateRecord,
  type EstimateStatus,
  type Complexity,
  type DiscountType,
  type DepositType,
} from '@/lib/pricing-shared'
import { CustomerEstimateDocument } from '@/components/admin/customer-estimate-document'
import type { BusinessProfile } from '@/lib/business-profile'

type SelectedCapabilityState = {
  capabilityId: string
  quantity: number
  overridePrice?: number
  discount: number
  internalNote: string
  clientNote: string
}

type CustomLineItemState = {
  id: string
  label: string
  category: string
  description: string
  quantity: number
  unitPrice: number
  clientNote: string
}

type SelectedRecurringState = {
  serviceId: string
  customPrice?: number
  notes: string
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
      <span className="flex items-center justify-between">
        <span>
          {label} {required && <span className="text-primary">*</span>}
        </span>
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function EstimateBuilder({
  capabilities,
  platforms,
  recurringServices,
  initialEstimate,
  businessProfile,
}: {
  capabilities: PricingCapability[]
  platforms: PricingPlatform[]
  recurringServices: RecurringService[]
  initialEstimate?: EstimateRecord | null
  businessProfile: BusinessProfile
}) {
  const router = useRouter()
  const isEditing = Boolean(initialEstimate?.id)

  // Header & Customer details
  const [estimateNumber, setEstimateNumber] = useState(
    initialEstimate?.estimateNumber ||
      `RRD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  )
  const [status, setStatus] = useState<EstimateStatus>(initialEstimate?.status || 'Draft')
  const [expirationDate, setExpirationDate] = useState(
    initialEstimate?.expirationDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )

  const [clientName, setClientName] = useState(initialEstimate?.clientName || '')
  const [company, setCompany] = useState(initialEstimate?.company || '')
  const [email, setEmail] = useState(initialEstimate?.email || '')
  const [phone, setPhone] = useState(initialEstimate?.phone || '')
  const [projectName, setProjectName] = useState(initialEstimate?.projectName || '')
  const [industry, setIndustry] = useState(initialEstimate?.industrySlug || 'solar')
  const [projectOverview, setProjectOverview] = useState(
    initialEstimate?.projectOverview || DEFAULT_OVERVIEW
  )

  // Platform selection
  const [platformId, setPlatformId] = useState(
    initialEstimate?.platformId || platforms[0]?.id || ''
  )
  const selectedPlatform = platforms.find((p) => p.id === platformId)
  const [platformPrice, setPlatformPrice] = useState<number>(() => {
    if (initialEstimate?.platformPrice !== undefined) return initialEstimate.platformPrice
    return selectedPlatform?.suggestedLowPrice || 2500
  })

  // Selected Capabilities
  const [selectedCaps, setSelectedCaps] = useState<SelectedCapabilityState[]>(() => {
    if (!initialEstimate) return []
    return initialEstimate.items
      .filter((item) => item.capabilityId && !item.isCustom)
      .map((item) => ({
        capabilityId: item.capabilityId!,
        quantity: item.quantity || 1,
        overridePrice: item.manualPriceOverride,
        discount: item.discount || 0,
        internalNote: item.internalNote || '',
        clientNote: item.clientNote || '',
      }))
  })

  // Custom Line Items
  const [customItems, setCustomItems] = useState<CustomLineItemState[]>(() => {
    if (!initialEstimate) return []
    return initialEstimate.items
      .filter((item) => item.isCustom || !item.capabilityId)
      .map((item) => ({
        id: item.id || `custom-${Math.random().toString(36).slice(2, 8)}`,
        label: item.label,
        category: item.category || 'Custom Work',
        description: item.description || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        clientNote: item.clientNote || '',
      }))
  })

  // Recurring Services
  const [selectedRecurring, setSelectedRecurring] = useState<SelectedRecurringState[]>(() => {
    if (!initialEstimate || !initialEstimate.recurringItems) return []
    return initialEstimate.recurringItems.map((item) => ({
      serviceId: item.id,
      customPrice: item.monthlyClientPrice,
      notes: item.notes || '',
    }))
  })

  // Adjustments & Financial Options
  const [complexity, setComplexity] = useState<Complexity>(initialEstimate?.complexity || 'Medium')
  const [customLabor, setCustomLabor] = useState<number>(initialEstimate?.customLabor || 0)
  const [contingencyRate, setContingencyRate] = useState<number>(initialEstimate?.contingencyRate || 0)
  const [discountType, setDiscountType] = useState<DiscountType>(initialEstimate?.discountType || 'fixed')
  const [discountValue, setDiscountValue] = useState<number>(
    initialEstimate?.discountValue || (initialEstimate?.discount ? initialEstimate.discount : 0)
  )

  const [taxEnabled, setTaxEnabled] = useState<boolean>(initialEstimate?.taxEnabled || false)
  const [taxRate, setTaxRate] = useState<number>(initialEstimate?.taxRate || 6.5)

  const [depositType, setDepositType] = useState<DepositType>(initialEstimate?.depositType || 'percent')
  const [depositValue, setDepositValue] = useState<number>(
    initialEstimate?.depositValue !== undefined ? initialEstimate.depositValue : 50
  )

  // Contract Terms & Notes
  const [assumptions, setAssumptions] = useState(initialEstimate?.assumptions || DEFAULT_ASSUMPTIONS)
  const [exclusions, setExclusions] = useState(initialEstimate?.exclusions || DEFAULT_EXCLUSIONS)
  const [timeline, setTimeline] = useState(initialEstimate?.timeline || DEFAULT_TIMELINE)
  const [nextSteps, setNextSteps] = useState(initialEstimate?.nextSteps || DEFAULT_NEXT_STEPS)
  const [internalNotes, setInternalNotes] = useState(
    initialEstimate?.internalNotes || initialEstimate?.notes || ''
  )

  // UI Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Categories list
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(capabilities.map((c) => c.category)))]
  }, [capabilities])

  // Suggested capabilities for the selected industry
  const recommendedSlugs = useMemo(() => {
    return new Set(suggestedCapabilities(capabilities, industry))
  }, [capabilities, industry])

  // When platform changes, update platform price default if it was on previous platform default
  function handlePlatformChange(newId: string) {
    setPlatformId(newId)
    const plat = platforms.find((p) => p.id === newId)
    if (plat) {
      setPlatformPrice(plat.suggestedLowPrice)
    }
  }

  // Overlap detection
  const selectedCapabilitySlugs = useMemo(() => {
    return selectedCaps
      .map((sc) => capabilities.find((c) => c.id === sc.capabilityId)?.slug)
      .filter(Boolean) as string[]
  }, [selectedCaps, capabilities])

  const detectedOverlaps = useMemo(() => {
    return detectOverlappingCapabilities(selectedCapabilitySlugs)
  }, [selectedCapabilitySlugs])

  // Map selected capabilities for calculation engine
  const calculationCaps = useMemo(() => {
    return selectedCaps.map((sc) => {
      const cap = capabilities.find((c) => c.id === sc.capabilityId)
      if (!cap) {
        return {
          capability: {
            id: sc.capabilityId,
            name: 'Item',
            slug: 'item',
            category: 'Feature',
            description: '',
            internalBasePrice: 0,
            minimumPrice: 0,
            suggestedLowPrice: 0,
            suggestedHighPrice: 0,
            complexity: 'Medium' as Complexity,
            estimatedHoursLow: 0,
            estimatedHoursHigh: 0,
            monthlySupportImpact: 'None',
            thirdPartyCosts: [],
            dependencies: [],
            industries: [],
            demoIncluded: false,
            productionReady: true,
            internalNotes: '',
            active: true,
          },
          quantity: sc.quantity,
          overridePrice: sc.overridePrice,
          discount: sc.discount,
        }
      }
      return {
        capability: cap,
        quantity: sc.quantity,
        overridePrice: sc.overridePrice,
        discount: sc.discount,
      }
    })
  }, [selectedCaps, capabilities])

  const calculationRecurring = useMemo(() => {
    return selectedRecurring.map((sr) => {
      const service = recurringServices.find((s) => s.id === sr.serviceId)
      return {
        monthlyClientPrice: sr.customPrice !== undefined ? sr.customPrice : service?.monthlyClientPrice || 0,
      }
    })
  }, [selectedRecurring, recurringServices])

  // Calculate live authoritative totals
  const totals = useMemo(() => {
    return calculateEstimateTotals({
      platformPrice,
      platformSlug: selectedPlatform?.slug,
      capabilities: calculationCaps,
      customItems,
      customLabor,
      complexity,
      contingencyRate,
      discountType,
      discountValue,
      taxEnabled,
      taxRate,
      depositType,
      depositValue,
      recurringItems: calculationRecurring,
    })
  }, [
    platformPrice,
    selectedPlatform,
    calculationCaps,
    customItems,
    customLabor,
    complexity,
    contingencyRate,
    discountType,
    discountValue,
    taxEnabled,
    taxRate,
    depositType,
    depositValue,
    calculationRecurring,
  ])

  // Toggle Capability selection
  function toggleCapability(cap: PricingCapability) {
    setSelectedCaps((current) => {
      const exists = current.some((item) => item.capabilityId === cap.id)
      if (exists) {
        return current.filter((item) => item.capabilityId !== cap.id)
      } else {
        const isIncluded = isCapabilityIncludedInPlatform(selectedPlatform?.slug, cap.slug)
        return [
          ...current,
          {
            capabilityId: cap.id,
            quantity: 1,
            overridePrice: isIncluded ? 0 : cap.internalBasePrice,
            discount: 0,
            internalNote: '',
            clientNote: '',
          },
        ]
      }
    })
  }

  // Update capability quantity or override price
  function updateCapQuantity(capabilityId: string, quantity: number) {
    setSelectedCaps((current) =>
      current.map((item) =>
        item.capabilityId === capabilityId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    )
  }

  function updateCapPriceOverride(capabilityId: string, price: number | undefined) {
    setSelectedCaps((current) =>
      current.map((item) =>
        item.capabilityId === capabilityId ? { ...item, overridePrice: price } : item
      )
    )
  }

  function updateCapClientNote(capabilityId: string, note: string) {
    setSelectedCaps((current) =>
      current.map((item) =>
        item.capabilityId === capabilityId ? { ...item, clientNote: note } : item
      )
    )
  }

  // Custom Items Management
  function addCustomItem() {
    setCustomItems((current) => [
      ...current,
      {
        id: `custom-${Math.random().toString(36).slice(2, 9)}`,
        label: 'Custom Feature / Consulting',
        category: 'Custom Scope',
        description: 'Specific bespoke feature or consultation outside standard library.',
        quantity: 1,
        unitPrice: 500,
        clientNote: '',
      },
    ])
  }

  function updateCustomItem(id: string, updates: Partial<CustomLineItemState>) {
    setCustomItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  function removeCustomItem(id: string) {
    setCustomItems((current) => current.filter((item) => item.id !== id))
  }

  // Recurring Services Management
  function toggleRecurring(service: RecurringService) {
    setSelectedRecurring((current) => {
      const exists = current.some((s) => s.serviceId === service.id)
      if (exists) {
        return current.filter((s) => s.serviceId !== service.id)
      } else {
        return [
          ...current,
          {
            serviceId: service.id,
            customPrice: service.monthlyClientPrice,
            notes: '',
          },
        ]
      }
    })
  }

  function updateRecurringPrice(serviceId: string, price: number) {
    setSelectedRecurring((current) =>
      current.map((s) => (s.serviceId === serviceId ? { ...s, customPrice: price } : s))
    )
  }

  // Validation
  function validateEstimate(): string | null {
    if (!clientName.trim() && !company.trim()) {
      return 'Please enter a Client Name or Company Name.'
    }
    if (!platformId) {
      return 'Please select a Base Platform.'
    }
    // Check if any non-included selected capability has zero or invalid price
    for (const sc of selectedCaps) {
      const cap = capabilities.find((c) => c.id === sc.capabilityId)
      if (cap) {
        const isIncluded = isCapabilityIncludedInPlatform(selectedPlatform?.slug, cap.slug)
        if (!isIncluded) {
          const finalPrice = sc.overridePrice !== undefined ? sc.overridePrice : cap.internalBasePrice
          if (finalPrice <= 0 && cap.internalBasePrice <= 0) {
            return `Capability "${cap.name}" requires an explicit quoted price before saving.`
          }
        }
      }
    }
    return null
  }

  // Build full payload for save
  function buildPayload(targetStatus: EstimateStatus) {
    const itemsSnapshot = [
      ...selectedCaps.map((sc) => {
        const cap = capabilities.find((c) => c.id === sc.capabilityId)!
        const isIncluded = isCapabilityIncludedInPlatform(selectedPlatform?.slug, cap.slug)
        return {
          capabilityId: cap.id,
          label: cap.name,
          category: cap.category,
          description: cap.description,
          quantity: sc.quantity,
          unitPrice: isIncluded ? 0 : cap.internalBasePrice,
          manualPriceOverride: isIncluded ? 0 : sc.overridePrice,
          discount: sc.discount,
          isIncluded,
          isCustom: false,
          estimatedHoursLow: cap.estimatedHoursLow,
          estimatedHoursHigh: cap.estimatedHoursHigh,
          internalNote: sc.internalNote,
          clientNote: sc.clientNote,
        }
      }),
      ...customItems.map((ci) => ({
        label: ci.label,
        category: ci.category,
        description: ci.description,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        manualPriceOverride: ci.unitPrice,
        discount: 0,
        isIncluded: false,
        isCustom: true,
        estimatedHoursLow: Math.round(ci.quantity * 2),
        estimatedHoursHigh: Math.round(ci.quantity * 4),
        internalNote: '',
        clientNote: ci.clientNote,
      })),
    ]

    const recurringSnapshot = selectedRecurring.map((sr) => {
      const service = recurringServices.find((s) => s.id === sr.serviceId)!
      return {
        id: service.id,
        name: service.name,
        slug: service.slug,
        monthlyClientPrice: sr.customPrice !== undefined ? sr.customPrice : service.monthlyClientPrice,
        billingFrequency: service.billingFrequency,
        includedHours: service.includedHours,
        notes: sr.notes || service.notes,
      }
    })

    return {
      estimateNumber,
      clientName: clientName.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      projectName: projectName.trim() || `${company || clientName || 'Client'} Web Platform`,
      projectOverview,
      industrySlug: industry,
      projectType: projectName.trim() || 'Custom Web Platform',
      platformId,
      platformName: selectedPlatform?.name || 'Base Platform',
      platformPrice,
      status: targetStatus,
      expirationDate,
      customLabor,
      complexity,
      contingencyRate,
      discountType,
      discountValue,
      taxEnabled,
      taxRate,
      depositType,
      depositValue,
      notes: internalNotes,
      internalNotes,
      assumptions,
      exclusions,
      timeline,
      nextSteps,
      items: itemsSnapshot,
      recurringItems: recurringSnapshot,
    }
  }

  // Save handler
  async function handleSave(targetStatus: EstimateStatus = status) {
    const errorMsg = validateEstimate()
    if (errorMsg) {
      toast.error(errorMsg)
      return
    }

    setIsSaving(true)
    try {
      const payload = buildPayload(targetStatus)
      if (isEditing && initialEstimate?.id) {
        await updateEstimate(initialEstimate.id, payload)
        toast.success(`Estimate ${payload.estimateNumber} updated successfully.`)
        setStatus(targetStatus)
      } else {
        const res = await createEstimate(payload)
        toast.success(`Estimate ${res.estimateNumber} created.`)
        router.push(`/admin/estimating/${res.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save estimate.')
    } finally {
      setIsSaving(false)
    }
  }

  // Duplicate handler
  async function handleDuplicate() {
    if (!initialEstimate?.id) return
    setIsSaving(true)
    try {
      const res = await duplicateEstimateAction(initialEstimate.id)
      toast.success(`Duplicated to ${res.estimateNumber}.`)
      router.push(`/admin/estimating/${res.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate estimate.')
    } finally {
      setIsSaving(false)
    }
  }

  // Filtered Capabilities for catalog browsing
  const filteredCapabilities = useMemo(() => {
    return capabilities.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        `${item.name} ${item.description} ${item.category}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [capabilities, searchQuery, selectedCategory])

  // Build ephemeral record for preview document
  const previewEstimateRecord: EstimateRecord = useMemo(() => {
    const payload = buildPayload(status)
    return {
      id: initialEstimate?.id || 'preview-id',
      estimateNumber: payload.estimateNumber,
      clientName: payload.clientName,
      company: payload.company,
      email: payload.email,
      phone: payload.phone,
      projectName: payload.projectName,
      projectOverview: payload.projectOverview,
      industrySlug: payload.industrySlug,
      platformId: payload.platformId,
      platformName: payload.platformName,
      platformPrice: payload.platformPrice,
      status: payload.status,
      expirationDate: payload.expirationDate,
      basePrice: payload.platformPrice,
      capabilitySubtotal: totals.capabilitySubtotal,
      thirdPartySetupCost: 0,
      customLabor: totals.customLabor,
      complexity: payload.complexity,
      complexityAdjustment: totals.complexityAdjustment,
      contingency: totals.contingencyAmount,
      contingencyRate: totals.contingencyRate,
      discountType: totals.discountType,
      discountValue: totals.discountValue,
      discount: totals.discountAmount,
      taxEnabled: totals.taxEnabled,
      taxRate: totals.taxRate,
      tax: totals.taxAmount,
      totalPrice: totals.totalPrice,
      recurringTotal: totals.recurringTotal,
      depositType: totals.depositType,
      depositValue: totals.depositValue,
      depositAmount: totals.depositAmount,
      remainingBalance: totals.remainingBalance,
      estimatedHoursLow: totals.estimatedHoursLow,
      estimatedHoursHigh: totals.estimatedHoursHigh,
      internalCost: totals.internalCost,
      notes: payload.notes,
      internalNotes: payload.internalNotes,
      assumptions: payload.assumptions,
      exclusions: payload.exclusions,
      timeline: payload.timeline,
      nextSteps: payload.nextSteps,
      items: payload.items.map((item, idx) => ({
        id: `item-${idx}`,
        ...item,
      })),
      recurringItems: payload.recurringItems.map((item, idx) => ({
        id: item.id || `rec-${idx}`,
        ...item,
      })),
      createdAt: initialEstimate?.createdAt || new Date().toISOString(),
    }
  }, [buildPayload, status, initialEstimate, totals])

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-7xl">
        {/* Top Header & Breadcrumbs */}
        <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Link href="/admin/pricing" className="hover:underline">
                Pricing & Estimating
              </Link>
              <span>/</span>
              <span>{isEditing ? `Edit ${estimateNumber}` : 'New Estimate'}</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {isEditing ? `Estimate ${estimateNumber}` : 'Estimate Builder'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select platform foundations, itemize capabilities, adjust terms, and generate an authoritative customer PDF.
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreviewModal(true)}
              className="gap-1.5"
            >
              <Eye className="size-4" /> Preview Customer PDF
            </Button>
            {isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                disabled={isSaving}
                className="gap-1.5"
              >
                <Copy className="size-4" /> Duplicate
              </Button>
            )}
            <Button
              onClick={() => handleSave('Draft')}
              disabled={isSaving}
              variant="secondary"
              size="sm"
            >
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave('Ready to Review')}
              disabled={isSaving}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSaving ? 'Saving…' : 'Save & Ready'}
            </Button>
          </div>
        </header>

        {/* Potential Overlaps Warning Alert */}
        {detectedOverlaps.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-300">Potential Scope Overlaps Detected</p>
                {detectedOverlaps.map((item, idx) => (
                  <p key={idx} className="text-xs text-amber-200/90 leading-relaxed">
                    • {item.warning}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main 2-Column Layout */}
        <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
          {/* Left Column: Form & Scope Selectors */}
          <div className="flex flex-col gap-8">
            {/* 1. Client & Project Details */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">1. Client & Project Details</h2>
                  <p className="text-xs text-muted-foreground">General customer contact and quote parameters</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EstimateStatus)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold text-foreground"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Ready to Review">Ready to Review</option>
                    <option value="Sent">Sent</option>
                    <option value="Negotiating">Negotiating</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Declined">Declined</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Client / Contact Name" required>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                  />
                </FormField>
                <FormField label="Company Name" required>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Apex Solar Solutions"
                  />
                </FormField>
                <FormField label="Client Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah@apexsolar.com"
                  />
                </FormField>
                <FormField label="Client Phone">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 234-5678"
                  />
                </FormField>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Project Name / Type">
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Commercial Solar Lead Engine"
                  />
                </FormField>
                <FormField label="Target Industry">
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    {pricingIndustries.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Estimate Number">
                  <Input
                    value={estimateNumber}
                    onChange={(e) => setEstimateNumber(e.target.value)}
                    className="font-mono text-xs"
                  />
                </FormField>
                <FormField label="Valid Through (Expiration)">
                  <Input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="mt-4">
                <FormField label="Project Overview & Objectives" hint="Appears prominently in the customer PDF">
                  <textarea
                    value={projectOverview}
                    onChange={(e) => setProjectOverview(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed text-foreground"
                    placeholder="Summarize the high-level goals and deliverables of the engagement."
                  />
                </FormField>
              </div>
            </section>

            {/* 2. Base Platform Foundation */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-semibold text-card-foreground">2. Base Platform Architecture</h2>
                <p className="text-xs text-muted-foreground">
                  Select the core foundation. Included features are bundled automatically at $0.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {platforms.map((plat) => {
                  const isSelected = plat.id === platformId
                  const includedCaps = capabilities.filter((c) =>
                    isCapabilityIncludedInPlatform(plat.slug, c.slug)
                  )
                  return (
                    <div
                      key={plat.id}
                      onClick={() => handlePlatformChange(plat.id)}
                      className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border bg-muted/30 hover:border-border/80 hover:bg-muted/60'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-foreground">{plat.name}</h3>
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input'
                            }`}
                          >
                            {isSelected && <Check className="size-3" />}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {plat.description}
                        </p>
                        <p className="mt-3 text-xs font-medium text-foreground">
                          Suggested: {formatCurrency(plat.suggestedLowPrice)} – {formatCurrency(plat.suggestedHighPrice)}
                        </p>
                      </div>

                      {includedCaps.length > 0 && (
                        <div className="mt-4 border-t border-border/60 pt-2.5">
                          <p className="text-[11px] font-semibold text-primary">
                            {includedCaps.length} Features Included ($0):
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {includedCaps.map((c) => c.name).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Quoted Platform Price Adjustment */}
              {selectedPlatform && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background/50 p-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Quoted Platform Price for {selectedPlatform.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Suggested range: {formatCurrency(selectedPlatform.suggestedLowPrice)} –{' '}
                      {formatCurrency(selectedPlatform.suggestedHighPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Platform Fee:</span>
                    <div className="relative w-36">
                      <DollarSign className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        step="50"
                        value={platformPrice}
                        onChange={(e) => setPlatformPrice(Math.max(0, Number(e.target.value) || 0))}
                        className="pl-7 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Pricing Library Capabilities */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">3. Pricing Library Capabilities</h2>
                  <p className="text-xs text-muted-foreground">
                    Select additional features. Included platform features are marked and not charged.
                  </p>
                </div>
                <div className="text-xs font-medium text-primary">
                  {selectedCaps.length} selected ({selectedCaps.filter((sc) => {
                    const c = capabilities.find((cap) => cap.id === sc.capabilityId)
                    return c && !isCapabilityIncludedInPlatform(selectedPlatform?.slug, c.slug)
                  }).length} billable)
                </div>
              </div>

              {/* Search & Category Pills */}
              <div className="mt-4 flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search capabilities by name, description, or keyword…"
                    className="pl-9 text-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capabilities Table / Rows */}
              <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
                {filteredCapabilities.map((cap) => {
                  const selectedItem = selectedCaps.find((s) => s.capabilityId === cap.id)
                  const isSelected = Boolean(selectedItem)
                  const isIncluded = isCapabilityIncludedInPlatform(selectedPlatform?.slug, cap.slug)
                  const isRecommended = recommendedSlugs.has(cap.slug)
                  const quotedUnitPrice =
                    selectedItem?.overridePrice !== undefined
                      ? selectedItem.overridePrice
                      : isIncluded
                      ? 0
                      : cap.internalBasePrice

                  return (
                    <div
                      key={cap.id}
                      className={`p-4 transition-colors ${
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        {/* Left Checkbox & Description */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleCapability(cap)}
                            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input hover:border-primary/50'
                            }`}
                          >
                            {isSelected && <Check className="size-3" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">{cap.name}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {cap.category}
                              </Badge>
                              {isRecommended && (
                                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                                  Industry Suggested
                                </Badge>
                              )}
                              {isIncluded && (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                                  Included with Platform ($0)
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                              {cap.description}
                            </p>
                          </div>
                        </div>

                        {/* Right Pricing & Controls */}
                        <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
                          <div className="text-right">
                            <span className="text-xs font-semibold text-foreground">
                              {isIncluded ? 'Included ($0)' : formatCurrency(cap.internalBasePrice)}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {formatCurrency(cap.suggestedLowPrice)}–{formatCurrency(cap.suggestedHighPrice)}
                            </span>
                          </div>

                          {/* When selected, show quantity and override controls */}
                          {isSelected && (
                            <div className="flex items-center gap-2 rounded-md border border-border bg-card p-1.5">
                              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                Qty:
                                <input
                                  type="number"
                                  min="1"
                                  value={selectedItem.quantity}
                                  onChange={(e) =>
                                    updateCapQuantity(cap.id, Number(e.target.value) || 1)
                                  }
                                  className="h-6 w-12 rounded border border-input bg-background px-1 text-center font-mono text-xs text-foreground"
                                />
                              </label>

                              {!isIncluded && (
                                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  Quote $:
                                  <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    value={quotedUnitPrice}
                                    onChange={(e) =>
                                      updateCapPriceOverride(
                                        cap.id,
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="h-6 w-20 rounded border border-input bg-background px-1 text-right font-mono text-xs text-foreground"
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Optional Client Scope Note for this feature */}
                      {isSelected && (
                        <div className="mt-3 pl-8">
                          <input
                            type="text"
                            value={selectedItem.clientNote}
                            onChange={(e) => updateCapClientNote(cap.id, e.target.value)}
                            placeholder="Optional custom scope detail shown on customer PDF for this feature…"
                            className="h-7 w-full rounded border border-input bg-background/70 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}

                {filteredCapabilities.length === 0 && (
                  <p className="p-8 text-center text-xs text-muted-foreground">
                    No capabilities match &quot;{searchQuery}&quot; in category &quot;{selectedCategory}&quot;.
                  </p>
                )}
              </div>
            </section>

            {/* 4. Custom Line Items (Outside Library) */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">4. Custom Line Items</h2>
                  <p className="text-xs text-muted-foreground">
                    Add bespoke deliverables or specialized consulting not in the standard catalog.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addCustomItem} className="gap-1.5">
                  <Plus className="size-3.5" /> Add Custom Item
                </Button>
              </div>

              {customItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {customItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-background p-4 shadow-sm"
                    >
                      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_6rem_8rem_auto] sm:items-center">
                        <FormField label="Item Name / Deliverable">
                          <Input
                            value={item.label}
                            onChange={(e) => updateCustomItem(item.id, { label: e.target.value })}
                            placeholder="e.g. Drone Video Editing & Integration"
                            className="text-xs"
                          />
                        </FormField>
                        <FormField label="Category">
                          <Input
                            value={item.category}
                            onChange={(e) => updateCustomItem(item.id, { category: e.target.value })}
                            placeholder="e.g. Media Production"
                            className="text-xs"
                          />
                        </FormField>
                        <FormField label="Qty">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateCustomItem(item.id, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="text-center font-mono text-xs"
                          />
                        </FormField>
                        <FormField label="Unit Price ($)">
                          <Input
                            type="number"
                            min="0"
                            step="50"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateCustomItem(item.id, {
                                unitPrice: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="text-right font-mono text-xs"
                          />
                        </FormField>
                        <div className="flex items-end justify-end pb-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCustomItem(item.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateCustomItem(item.id, { description: e.target.value })}
                          placeholder="Brief description for customer review…"
                          className="h-7 w-full rounded border border-input bg-background/50 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No custom line items added. Use the button above to add custom deliverables outside the master pricing library.
                </div>
              )}
            </section>

            {/* 5. Optional Recurring Services */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-semibold text-card-foreground">5. Optional Recurring Support Plans</h2>
                <p className="text-xs text-muted-foreground">
                  Proactive maintenance, managed updates, and retained support hours.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {recurringServices.map((service) => {
                  const selected = selectedRecurring.find((s) => s.serviceId === service.id)
                  const isChecked = Boolean(selected)
                  return (
                    <div
                      key={service.id}
                      className={`flex flex-col justify-between rounded-lg border p-4 transition-colors ${
                        isChecked ? 'border-primary bg-primary/5' : 'border-border bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRecurring(service)}
                            className="mt-1 size-4 rounded border-input"
                          />
                          <div>
                            <p className="font-semibold text-xs text-foreground">{service.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {service.includedHours > 0
                                ? `${service.includedHours} hrs included / month`
                                : 'Automated monitoring'}
                            </p>
                          </div>
                        </label>
                        <div className="text-right">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {formatCurrency(service.monthlyClientPrice)}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">/ month</span>
                        </div>
                      </div>

                      {isChecked && (
                        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                          <span className="text-muted-foreground">Quoted Rate:</span>
                          <div className="flex items-center gap-1 font-mono">
                            <span>$</span>
                            <input
                              type="number"
                              min="0"
                              value={selected.customPrice ?? service.monthlyClientPrice}
                              onChange={(e) =>
                                updateRecurringPrice(service.id, Number(e.target.value) || 0)
                              }
                              className="h-6 w-20 rounded border border-input bg-background px-1.5 text-right font-mono text-xs"
                            />
                            <span className="text-muted-foreground">/mo</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 6. Terms, Assumptions, Exclusions, Timeline */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-semibold text-card-foreground">6. Estimate Terms & Scope Notes</h2>
                <p className="text-xs text-muted-foreground">
                  Clear expectations protect both Rooster&apos;s Ridge Digital and the customer.
                </p>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <FormField label="Project Assumptions" hint="Included in Customer PDF">
                  <textarea
                    value={assumptions}
                    onChange={(e) => setAssumptions(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed text-foreground"
                  />
                </FormField>
                <FormField label="Scope Exclusions" hint="Included in Customer PDF">
                  <textarea
                    value={exclusions}
                    onChange={(e) => setExclusions(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed text-foreground"
                  />
                </FormField>
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <FormField label="Estimated Timeline & Delivery" hint="Included in Customer PDF">
                  <textarea
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed text-foreground"
                  />
                </FormField>
                <FormField label="Next Steps & Acceptance Process" hint="Included in Customer PDF">
                  <textarea
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed text-foreground"
                  />
                </FormField>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <FormField
                  label="Private Internal Notes"
                  hint="Strictly excluded from customer PDF (hours, risk notes, margin strategy)"
                >
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-foreground"
                    placeholder="Internal margin thoughts, follow-up questions, client history notes…"
                  />
                </FormField>
              </div>
            </section>
          </div>

          {/* Right Column: Sticky Estimate Summary & Financial Controls */}
          <aside className="xl:sticky xl:top-20 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Live Estimate Total
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {status}
                </Badge>
              </div>

              {/* Large Display Totals */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">One-Time Project Investment</p>
                <p className="mt-0.5 font-mono text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(totals.totalPrice)}
                </p>
                {totals.recurringTotal > 0 && (
                  <p className="mt-1 text-xs font-medium text-primary">
                    + {formatCurrency(totals.recurringTotal)} / month optional support
                  </p>
                )}
              </div>

              {/* Line item breakdown list */}
              <div className="mt-5 space-y-2.5 border-t border-border pt-4 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Base Platform ({selectedPlatform?.name || 'Platform'}):</span>
                  <span className="font-mono text-foreground">{formatCurrency(totals.platformPrice)}</span>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span>Capabilities Subtotal:</span>
                  <span className="font-mono text-foreground">{formatCurrency(totals.capabilitySubtotal)}</span>
                </div>

                {customItems.length > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custom Items ({customItems.length}):</span>
                    <span className="font-mono text-foreground">{formatCurrency(totals.customItemsSubtotal)}</span>
                  </div>
                )}

                {totals.customLabor > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custom Labor:</span>
                    <span className="font-mono text-foreground">{formatCurrency(totals.customLabor)}</span>
                  </div>
                )}

                {totals.complexityAdjustment > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Complexity ({complexity} Multiplier):</span>
                    <span className="font-mono text-foreground">+{formatCurrency(totals.complexityAdjustment)}</span>
                  </div>
                )}

                {totals.contingencyAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Contingency ({totals.contingencyRate}%):</span>
                    <span className="font-mono text-foreground">+{formatCurrency(totals.contingencyAmount)}</span>
                  </div>
                )}

                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>
                      Discount {discountType === 'percent' ? `(${discountValue}%)` : '(Fixed)'}:
                    </span>
                    <span className="font-mono">−{formatCurrency(totals.discountAmount)}</span>
                  </div>
                )}

                {totals.taxEnabled && totals.taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated Tax ({totals.taxRate}%):</span>
                    <span className="font-mono text-foreground">+{formatCurrency(totals.taxAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-border pt-2.5 font-bold text-sm text-foreground">
                  <span>Total Project Investment:</span>
                  <span className="font-mono text-primary">{formatCurrency(totals.totalPrice)}</span>
                </div>
              </div>

              {/* Deposit & Balance Schedule */}
              {totals.depositAmount > 0 && (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs">
                  <div className="flex justify-between font-semibold text-foreground">
                    <span>Initial Deposit ({depositType === 'percent' ? `${depositValue}%` : 'Fixed'}):</span>
                    <span className="font-mono">{formatCurrency(totals.depositAmount)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-muted-foreground">
                    <span>Balance Due Upon Launch:</span>
                    <span className="font-mono">{formatCurrency(totals.remainingBalance)}</span>
                  </div>
                </div>
              )}

              {/* Quick Adjustment Inputs */}
              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Complexity Multiplier</span>
                    <select
                      value={complexity}
                      onChange={(e) => setComplexity(e.target.value as Complexity)}
                      className="h-8 rounded border border-input bg-background px-2 text-xs font-semibold text-foreground"
                    >
                      <option value="Low">Low (1.0x)</option>
                      <option value="Medium">Medium (1.1x)</option>
                      <option value="High">High (1.25x)</option>
                      <option value="Custom">Custom (1.0x)</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Custom Labor ($)</span>
                    <input
                      type="number"
                      min="0"
                      value={customLabor || ''}
                      onChange={(e) => setCustomLabor(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="$0"
                      className="h-8 rounded border border-input bg-background px-2 text-right font-mono text-xs text-foreground"
                    />
                  </label>
                </div>

                {/* Discount Controller */}
                <div className="rounded-lg border border-border bg-background/50 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Project Discount:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          discountType === 'fixed'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        $ Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          discountType === 'percent'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        % Percent
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <input
                      type="number"
                      min="0"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                      placeholder={discountType === 'percent' ? 'e.g. 10%' : 'e.g. $500'}
                      className="h-8 w-full rounded border border-input bg-background px-2.5 text-right font-mono text-xs text-foreground"
                    />
                  </div>
                </div>

                {/* Optional Tax Toggle */}
                <div className="rounded-lg border border-border bg-background/50 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={taxEnabled}
                        onChange={(e) => setTaxEnabled(e.target.checked)}
                        className="size-3.5 rounded border-input"
                      />
                      <span className="font-medium text-foreground">Enable Tax Calculation</span>
                    </label>
                  </div>
                  {taxEnabled && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Tax Rate (%):</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value) || 0))}
                        className="h-7 w-20 rounded border border-input bg-background px-2 text-right font-mono text-xs text-foreground"
                      />
                    </div>
                  )}
                </div>

                {/* Deposit Controller */}
                <div className="rounded-lg border border-border bg-background/50 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Initial Deposit:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDepositType('percent')}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          depositType === 'percent'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        50% Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositType('none')}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          depositType === 'none'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        None
                      </button>
                    </div>
                  </div>
                  {depositType !== 'none' && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Deposit %:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={depositValue}
                        onChange={(e) => setDepositValue(Math.max(0, Number(e.target.value) || 0))}
                        className="h-7 w-20 rounded border border-input bg-background px-2 text-right font-mono text-xs text-foreground"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Internal Project Metrics Panel (Hidden from customer PDF) */}
              <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3.5 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-primary">
                    Internal Metrics (Private)
                  </span>
                  <Info className="size-3.5" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-muted-foreground">Effort Estimate:</span>
                    <p className="font-mono font-medium text-foreground">
                      {totals.estimatedHoursLow}–{totals.estimatedHoursHigh} hrs
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground">Estimated Internal Cost:</span>
                    <p className="font-mono font-medium text-foreground">
                      {formatCurrency(totals.internalCost)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => handleSave('Draft')}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save Draft Estimate'}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowPreviewModal(true)}
                    className="gap-1 text-xs"
                  >
                    <Eye className="size-3.5" /> Preview PDF
                  </Button>
                  {isEditing && initialEstimate?.id ? (
                    <Button
                      variant="outline"
                      render={<Link href={`/admin/estimating/${initialEstimate.id}/preview`} target="_blank" />}
                      className="gap-1 text-xs"
                    >
                      <Printer className="size-3.5" /> Export PDF
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowPreviewModal(true)}
                      className="gap-1 text-xs"
                    >
                      <Printer className="size-3.5" /> Export PDF
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Customer PDF Modal Preview */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <h3 className="font-semibold text-foreground">Customer PDF Preview</h3>
                <p className="text-xs text-muted-foreground">
                  Exact customer layout with internal metrics strictly excluded.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => window.print()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  size="sm"
                >
                  <Printer data-icon="inline-start" className="size-3.5" /> Print / Save PDF
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPreviewModal(false)}
                  aria-label="Close preview"
                >
                  <X className="size-5" />
                </Button>
              </div>
            </div>

            {/* Modal Body: Scrollable Document */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/80">
              <CustomerEstimateDocument
                estimate={previewEstimateRecord}
                profile={businessProfile}
                showControls={false}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
