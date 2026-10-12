-- Phase 2B: APPROVAL REQUIRED. Never applied by application startup.
-- Requires reviewed 001 and 002. Validate on an isolated Neon branch first.
-- Adds tenant policy/version storage and type metadata. No booking rows are altered.
-- RRD-only seeds below are adapter defaults, not scheduling-engine constants.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE rrd_scheduling.configuration (
  tenant_id uuid PRIMARY KEY REFERENCES rrd_scheduling.tenants(id),
  version integer NOT NULL DEFAULT 1,
  policies jsonb NOT NULL CHECK (jsonb_typeof(policies) = 'object')
);
ALTER TABLE rrd_scheduling.appointment_types
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN location text NOT NULL DEFAULT '',
  ADD COLUMN archived boolean NOT NULL DEFAULT false,
  ADD COLUMN intake_questions jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(intake_questions)='array');
ALTER TABLE rrd_scheduling.appointment_types DROP CONSTRAINT appointment_types_meeting_mode_check;
ALTER TABLE rrd_scheduling.appointment_types ADD CONSTRAINT appointment_types_meeting_mode_check CHECK (meeting_mode IN ('online','phone_or_online','phone','in_person'));
INSERT INTO rrd_scheduling.configuration (tenant_id,policies)
SELECT t.id,'{"approval":"automatic","cancellationMinutes":720,"reschedulingMinutes":720,"reminderMinutes":[],"allowMultiple":true}'::jsonb || jsonb_build_object('customerConfirmation',coalesce(n.customer_confirmation,false),'hostNotification',coalesce(n.host_notification,false),'cancellationNotice',coalesce(n.cancellation_notice,false)) FROM rrd_scheduling.tenants t LEFT JOIN rrd_scheduling.notification_settings n ON n.tenant_id=t.id;
-- Only seed requested RRD defaults when the tenant has no scheduling history.
UPDATE rrd_scheduling.tenants t SET time_zone='America/New_York' WHERE slug='roosters-ridge-digital' AND NOT EXISTS (SELECT 1 FROM rrd_scheduling.bookings b WHERE b.tenant_id=t.id);
UPDATE rrd_scheduling.appointment_types a SET minimum_notice_minutes=720,buffer_before_minutes=0,buffer_after_minutes=15,maximum_horizon_days=60 WHERE tenant_id IN (SELECT t.id FROM rrd_scheduling.tenants t WHERE slug='roosters-ridge-digital' AND NOT EXISTS (SELECT 1 FROM rrd_scheduling.bookings b WHERE b.tenant_id=t.id));
UPDATE rrd_scheduling.appointment_types a SET name='Website Design Consultation' WHERE slug='website-consultation' AND tenant_id IN (SELECT id FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital');
INSERT INTO rrd_scheduling.appointment_types (tenant_id,slug,name,duration_minutes,meeting_mode,minimum_notice_minutes,buffer_after_minutes,active)
SELECT id,'existing-client-meeting','Existing Client Meeting',30,'online',720,15,false FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital' ON CONFLICT (tenant_id,slug) DO NOTHING;
INSERT INTO rrd_scheduling.weekly_availability (tenant_id,host_id,weekday,start_minute,end_minute)
SELECT h.tenant_id,h.id,day,540,1020 FROM rrd_scheduling.hosts h JOIN rrd_scheduling.tenants t ON t.id=h.tenant_id CROSS JOIN generate_series(1,5) AS day
WHERE t.slug='roosters-ridge-digital' AND NOT EXISTS (SELECT 1 FROM rrd_scheduling.weekly_availability w WHERE w.tenant_id=h.tenant_id AND w.host_id=h.id) AND NOT EXISTS (SELECT 1 FROM rrd_scheduling.bookings b WHERE b.tenant_id=h.tenant_id);
-- New type links are provisioned disabled; this migration never activates public scheduling.
INSERT INTO rrd_scheduling.public_links (tenant_id,host_id,appointment_type_id,slug,enabled)
SELECT t.id,h.id,a.id,'rrd-existing-client-meeting',false FROM rrd_scheduling.tenants t JOIN rrd_scheduling.hosts h ON h.tenant_id=t.id JOIN rrd_scheduling.appointment_types a ON a.tenant_id=t.id AND a.slug='existing-client-meeting' WHERE t.slug='roosters-ridge-digital' ORDER BY h.id LIMIT 1 ON CONFLICT DO NOTHING;
COMMIT;
-- Review: retains UTC booking instants, inventory, tokens, public enablement, and staff membership.
-- Notifications/reminder preferences are stored only; no delivery worker or customer rescheduling UI is activated.
-- Rollback requires approval: first revert application version, then drop configuration and new type columns,
-- restoring the previous meeting-mode constraint only after checking no phone/in_person rows exist.
-- Default data updates need an isolated-branch snapshot to reverse safely; do not blindly overwrite tenant settings.
