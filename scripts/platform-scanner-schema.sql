CREATE TABLE IF NOT EXISTS public.platform_checks (
  user_id text NOT NULL,
  original_url text NOT NULL,
  result jsonb,
  checked_at timestamptz,
  lease_until timestamptz,
  PRIMARY KEY (user_id, original_url)
);

CREATE TABLE IF NOT EXISTS public.platform_scan_limits (
  user_id text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.platform_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  original_url text NOT NULL,
  business_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, original_url)
);
