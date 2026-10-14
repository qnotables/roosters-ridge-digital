import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MetricCards, ReportTable } from './platform-layout'
import type { createPlatformService } from '@/modules/scheduling/platform-service'

type Summary = Awaited<ReturnType<ReturnType<typeof createPlatformService>['overview']>>

export function MonitoringSummary({ summary }: { summary: Summary }) {
  const count = (state: string) => summary.jobs.filter(job => job.state === state).reduce((total, job) => total + Number(job.total), 0)
  const failed = count('failed'), review = count('review')
  const thresholdReached = summary.bookingFailurePercent !== null && summary.bookingFailurePercent >= summary.alertThreshold
  return <section aria-labelledby="monitoring-health" className="flex flex-col gap-4">
    <h3 id="monitoring-health" className="text-lg font-semibold">Health in selected scope</h3>
    <MetricCards items={[
      ['Measured booking attempts', summary.bookingAttempts],
      ['Booking failure rate', summary.bookingFailurePercent === null ? null : `${summary.bookingFailurePercent}%`],
      ['Pending notification jobs', count('pending')],
      ['Failed notification jobs', failed],
    ]} />
    {summary.bookingFailurePercent === null && <Alert><AlertTitle>No measured booking attempts</AlertTitle><AlertDescription>No instrumented booking outcomes were recorded in this scope and range. This is not evidence of a healthy or unhealthy system.</AlertDescription></Alert>}
    {thresholdReached && <Alert variant="destructive"><AlertTitle>Booking failure threshold reached</AlertTitle><AlertDescription>Measured booking failures are {summary.bookingFailurePercent}% against a {summary.alertThreshold}% threshold. Review sanitized outcomes for conflicts, traffic protection and configuration failures.</AlertDescription></Alert>}
    {(failed > 0 || review > 0) && <Alert><AlertTitle>Notification review required</AlertTitle><AlertDescription>{failed} failed and {review} jobs requiring review in this range. Reconcile review jobs and uncertain provider responses before any resend. Retry eligibility remains enforced server-side.</AlertDescription></Alert>}
    <p className="text-sm text-muted-foreground">Aggregates cover the full selected UTC creation-date range, not just the 100 most recent rows below. Job counts show current state for jobs created in that range; provider acceptance is not confirmed delivery. Alerts appear in this console only, not through email or paging.</p>
    <div className="grid gap-6 lg:grid-cols-2">
      <ReportTable title="Notification state totals" columns={[['state', 'State'], ['total', 'Jobs'], ['attempts', 'Attempts']]} rows={summary.jobs} />
      <ReportTable title="Operational outcome totals" columns={[['category', 'Category'], ['outcome', 'Outcome'], ['total', 'Events']]} rows={summary.events} />
    </div>
  </section>
}
