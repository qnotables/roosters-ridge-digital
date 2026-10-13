import 'server-only'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { AdminScope } from './admin-types'
import { validateConfiguration } from './configuration'
import { SchedulingError } from './types'
import { assertFeature, assertResourceLimit } from './platform-entitlements'

export async function saveConfiguration(db: NodePgDatabase, scope: AdminScope, input: unknown, version: number) {
  const c = validateConfiguration(input)
  if (!Number.isInteger(version) || version < 1) throw new SchedulingError('invalid','Refresh configuration before saving.')
  return db.transaction(async tx => {
    const tenant = await tx.execute(sql`SELECT id,time_zone FROM rrd_scheduling.tenants WHERE id=${scope.tenantId} FOR UPDATE`)
    await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${scope.tenantId} ORDER BY id FOR UPDATE`)
    if (scope.assignedOnly || scope.preserveTenantTimeZone) {
      if (c.kind !== 'availability' || tenant.rows[0]?.time_zone !== c.timeZone) throw new SchedulingError('forbidden','Business configuration requires tenant administrator access.')
      if (scope.assignedOnly) {
        const host = await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${scope.tenantId} AND id=${c.hostId} AND user_id=${scope.userId}`)
        if (!host.rows.length) throw new SchedulingError('forbidden','Personal availability access required.')
      }
    }
    if (c.kind === 'type' && c.active && !c.details.archived) await assertResourceLimit(tx,scope.tenantId,'types',c.id)
    if (c.kind === 'policies' && c.policies.reminderMinutes.length) await assertFeature(tx,scope.tenantId,'reminders')
    if (c.kind === 'policies' && c.policies.allowMultiple) await assertFeature(tx,scope.tenantId,'advancedRules')
    const changed = await tx.execute(sql`UPDATE rrd_scheduling.configuration SET version=version+1 WHERE tenant_id=${scope.tenantId} AND version=${version} RETURNING version`)
    if (!changed.rows.length) throw new SchedulingError('unavailable','Configuration changed. Refresh before saving.')
    let recordId = scope.tenantId
    if (c.kind === 'availability') {
      const host = await tx.execute(sql`UPDATE rrd_scheduling.hosts SET daily_limit=${c.dailyLimit} WHERE tenant_id=${scope.tenantId} AND id=${c.hostId} RETURNING id`)
      if (!host.rows.length) throw new SchedulingError('forbidden','Host not found in this tenant.')
      recordId=c.hostId
      await tx.execute(sql`UPDATE rrd_scheduling.tenants SET time_zone=${c.timeZone} WHERE id=${scope.tenantId}`)
      await tx.execute(sql`DELETE FROM rrd_scheduling.weekly_availability WHERE tenant_id=${scope.tenantId} AND host_id=${c.hostId}`)
      for (const w of c.weekly) await tx.execute(sql`INSERT INTO rrd_scheduling.weekly_availability (tenant_id,host_id,weekday,start_minute,end_minute) VALUES (${scope.tenantId},${c.hostId},${w.weekday},${w.startMinute},${w.endMinute})`)
      await tx.execute(sql`DELETE FROM rrd_scheduling.availability_exceptions WHERE tenant_id=${scope.tenantId} AND host_id=${c.hostId}`)
      for (const e of c.exceptions) await tx.execute(sql`INSERT INTO rrd_scheduling.availability_exceptions (tenant_id,host_id,date,closed,windows) VALUES (${scope.tenantId},${c.hostId},${e.date}::date,${e.closed},${JSON.stringify(e.windows)}::jsonb)`)
    } else if (c.kind === 'policies') {
      await tx.execute(sql`UPDATE rrd_scheduling.configuration SET policies=${JSON.stringify(c.policies)}::jsonb WHERE tenant_id=${scope.tenantId}`)
      await tx.execute(sql`UPDATE rrd_scheduling.notification_settings SET customer_confirmation=${c.policies.customerConfirmation},host_notification=${c.policies.hostNotification},cancellation_notice=${c.policies.cancellationNotice} WHERE tenant_id=${scope.tenantId}`)
    } else {
      if (c.details.intakeQuestions.some(q => typeof q !== 'string')) { const ready = await tx.execute(sql`SELECT to_regclass('rrd_scheduling.booking_responses') IS NOT NULL AS ready`); if (!ready.rows[0]?.ready) throw new SchedulingError('unavailable', 'Approve the Phase 4C response storage migration before activating structured questions.') }
      recordId=c.id ?? randomUUID()
      if (c.id) {
        const row = await tx.execute(sql`UPDATE rrd_scheduling.appointment_types SET slug=${c.slug},name=${c.name},duration_minutes=${c.durationMinutes},buffer_before_minutes=${c.bufferBeforeMinutes},buffer_after_minutes=${c.bufferAfterMinutes},minimum_notice_minutes=${c.minimumNoticeMinutes},maximum_horizon_days=${c.maximumHorizonDays},slot_interval_minutes=${c.slotIntervalMinutes},meeting_mode=${c.meetingMode},active=${c.active},description=${c.details.description},location=${c.details.location},archived=${c.details.archived},intake_questions=${JSON.stringify(c.details.intakeQuestions)}::jsonb WHERE tenant_id=${scope.tenantId} AND id=${c.id} RETURNING id`)
        if (!row.rows.length) throw new SchedulingError('forbidden','Appointment type not found in this tenant.')
      } else await tx.execute(sql`INSERT INTO rrd_scheduling.appointment_types (tenant_id,id,slug,name,duration_minutes,buffer_before_minutes,buffer_after_minutes,minimum_notice_minutes,maximum_horizon_days,slot_interval_minutes,price_cents,meeting_mode,active,description,location,archived,intake_questions) VALUES (${scope.tenantId},${recordId},${c.slug},${c.name},${c.durationMinutes},${c.bufferBeforeMinutes},${c.bufferAfterMinutes},${c.minimumNoticeMinutes},${c.maximumHorizonDays},${c.slotIntervalMinutes},0,${c.meetingMode},${c.active},${c.details.description},${c.details.location},${c.details.archived},${JSON.stringify(c.details.intakeQuestions)}::jsonb)`)
      if (!c.active) await tx.execute(sql`UPDATE rrd_scheduling.public_links SET enabled=false WHERE tenant_id=${scope.tenantId} AND appointment_type_id=${recordId}`)
      else {
        await tx.execute(sql`UPDATE rrd_scheduling.public_links SET enabled=true WHERE tenant_id=${scope.tenantId} AND appointment_type_id=${recordId}`)
        await tx.execute(sql`INSERT INTO rrd_scheduling.public_links (tenant_id,host_id,appointment_type_id,slug,enabled) SELECT ${scope.tenantId},h.id,${recordId},${recordId}::text || '-' || h.id::text,true FROM rrd_scheduling.hosts h WHERE h.tenant_id=${scope.tenantId} AND NOT EXISTS (SELECT 1 FROM rrd_scheduling.public_links l WHERE l.tenant_id=h.tenant_id AND l.host_id=h.id AND l.appointment_type_id=${recordId}) ON CONFLICT DO NOTHING`)
      }
    }
    await tx.execute(sql`INSERT INTO rrd_scheduling.admin_audit (tenant_id,record_id,actor_user_id,action) VALUES (${scope.tenantId},${recordId},${scope.userId},${'configuration_'+c.kind})`)
    return Number(changed.rows[0].version)
  })
}
