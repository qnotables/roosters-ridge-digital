-- Review only. Requires 001–007. Applied only to the approved isolated test branch.
-- Production application requires separate migration approval. No automatic execution.
CREATE TABLE IF NOT EXISTS rrd_scheduling.booking_responses (
  tenant_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  sealed_responses jsonb NOT NULL CHECK (jsonb_typeof(sealed_responses) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, booking_id),
  FOREIGN KEY (tenant_id, booking_id) REFERENCES rrd_scheduling.bookings(tenant_id, id)
);
