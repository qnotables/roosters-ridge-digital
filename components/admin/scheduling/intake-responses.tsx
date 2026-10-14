'use client'
import useSWR from 'swr'
import { loadBrandResponses } from '@/app/admin/scheduling/branding/actions'
export function IntakeResponses({ tenantId, bookingId }: { tenantId: string; bookingId: string }) {
  const { data, error, isLoading } = useSWR(['scheduling-intake', tenantId, bookingId], () => loadBrandResponses(tenantId, bookingId), { revalidateOnFocus: false, shouldRetryOnError: false })
  if (isLoading) return <p role="status" className="text-sm text-muted-foreground">Loading custom intake…</p>
  if (error) return <p role="alert" className="text-sm text-muted-foreground">Custom intake is unavailable or access is not authorized.</p>
  if (!data?.length) return null
  return <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="intake-responses-heading"><h3 id="intake-responses-heading" className="font-semibold">Original intake responses</h3><p className="text-xs text-muted-foreground">Immutable question and answer snapshot from the booking.</p><dl className="flex flex-col gap-4">{data.map(({ question, answer }) => <div key={question.id}><dt className="text-sm font-medium">{question.label}</dt><dd className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{typeof answer === 'boolean' ? answer ? 'Yes' : 'No' : answer || 'Not provided'}</dd></div>)}</dl></section>
}
