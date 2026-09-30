export type EmailMessage = {
  id: string;
  recipients: { to: string[]; cc: string[]; bcc: string[] };
  subject: string;
  html: string;
  plain_text: string;
  lead_id: string | null;
  estimate_id: string | null;
  project_name: string;
  state: string;
  sender_email: string | null;
  provider_id: string | null;
  last_error: string | null;
  retry_safe: boolean;
  attempt_at: string | null;
  accepted_at: string | null;
  created_at: string;
};
export type EmailFile = {
  id: string;
  name: string;
  size: number;
  content_type: string;
  estimate_id: string | null;
};
export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html: string;
};
export type EmailLead = {
  id: string;
  first_name: string;
  last_name: string | null;
  business_name: string | null;
  email: string;
};
export type EmailSetup = {
  sender: string;
  staffEmails: string[];
  replyTo: string;
  signature: string;
  ready: boolean;
  attachmentsReady: boolean;
  deliveryTrackingReady: boolean;
  missing: string[];
  domainStatus: string;
  domainName: string;
  records: {
    record: string;
    type: string;
    name: string;
    value: string;
    ttl: string;
    status: string;
    priority?: number;
  }[];
  providerError: string;
  webhookPath: string;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
};
export type WorkspaceData = {
  messages: EmailMessage[];
  leads: EmailLead[];
  setup: EmailSetup;
  staff: { id: string; name: string; email: string } | null;
  templates: EmailTemplate[];
};
export async function emailFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to load email workspace.");
  return data;
}
export async function emailOperation(
  action: string,
  values: Record<string, unknown> = {},
) {
  const response = await fetch("/api/admin/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...values }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Email operation failed.");
  return data;
}
