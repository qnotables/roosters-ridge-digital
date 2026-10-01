ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS conversation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rfc_message_id text,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS reference_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_html text,
  ADD COLUMN IF NOT EXISTS mail_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reply_address text,
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid;
ALTER TABLE email_settings
  ADD COLUMN IF NOT EXISTS incoming_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_received_at timestamptz;
CREATE TABLE IF NOT EXISTS email_inbound_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'dashboard',
  message_id uuid NOT NULL,
  provider_attachment_id text NOT NULL,
  name text NOT NULL,
  content_type text NOT NULL,
  size integer NOT NULL,
  content_base64 text,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, provider_attachment_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_rfc_unique ON email_messages(user_id,rfc_message_id) WHERE rfc_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_messages_conversation_idx ON email_messages(user_id,conversation_id,created_at);
