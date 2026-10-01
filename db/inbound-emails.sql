CREATE TABLE IF NOT EXISTS inbound_emails (
  event_id text PRIMARY KEY,
  provider_email_id text NOT NULL UNIQUE,
  from_address text NOT NULL,
  recipient_addresses jsonb NOT NULL,
  subject text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbound_emails_received_at_idx
  ON inbound_emails (received_at DESC);
