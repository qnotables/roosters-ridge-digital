import "server-only";
import { Resend } from "resend";
import { emailSettings, emailDb, query } from "@/lib/email-workspace-db";
import { EMAIL, escapeHtml } from "@/lib/email-workspace-shared";

export function emailProvider() {
  if (!process.env.RESEND_API_KEY)
    throw new Error("RESEND_API_KEY is missing.");
  return new Resend(process.env.RESEND_API_KEY);
}
export async function emailReadiness() {
  const settings = await emailSettings();
  const profileRows = await emailDb.execute(
    query`SELECT founder_name, founder_title, email, phone, show_phone FROM business_profile WHERE id=1`,
  );
  const profile = profileRows.rows[0];
  const replyTo = String(profile?.email || "").trim();
  const signature = profile
    ? `<p><strong>${escapeHtml(String(profile.founder_name))}</strong><br>${escapeHtml(String(profile.founder_title))}<br>Rooster’s Ridge Digital<br>${escapeHtml(replyTo)}${profile.show_phone && profile.phone ? `<br>${escapeHtml(String(profile.phone))}` : ""}</p>`
    : "";
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!settings.sender || !EMAIL.test(settings.sender))
    missing.push("Configured sender address");
  if (!replyTo || !EMAIL.test(replyTo))
    missing.push("Monitored Reply-To email in business profile");
  if (!process.env.RESEND_WEBHOOK_SECRET) missing.push("RESEND_WEBHOOK_SECRET");
  if (!process.env.RRD_EMAIL_BLOB_READ_WRITE_TOKEN)
    missing.push(
      "Separate private Blob store: RRD_EMAIL_BLOB_READ_WRITE_TOKEN",
    );
  if (!settings.staffEmails.length)
    missing.push("Approved staff email addresses");
  let domainStatus = "not checked";
  let records: {
    record: string;
    type: string;
    name: string;
    value: string;
    ttl: string;
    status: string;
    priority?: number;
  }[] = [];
  let domainName = "";
  let providerError = "";
  if (process.env.RESEND_API_KEY && EMAIL.test(settings.sender)) {
    try {
      const provider = emailProvider();
      const domain = settings.sender.split("@")[1].toLowerCase();
      const listed = await provider.domains.list();
      if (listed.error)
        throw new Error(
          "Unable to inspect Resend domains. Use a Resend key with domain read access.",
        );
      const configured = listed.data.data.find(
        (d) => d.name.toLowerCase() === domain,
      );
      if (!configured) {
        domainStatus = "not registered";
        missing.push("Sender domain registered in Resend");
      } else {
        const result = await provider.domains.get(configured.id);
        if (result.error)
          throw new Error("Unable to read sender-domain verification.");
        domainName = result.data.name;
        domainStatus = result.data.status;
        records = result.data.records.filter(
          (r) => r.record === "DKIM" || r.record === "SPF",
        );
        if (
          domainStatus !== "verified" ||
          result.data.capabilities.sending !== "enabled"
        )
          missing.push("Verified sending domain");
        if (result.data.open_tracking || result.data.click_tracking)
          missing.push("Disable domain open/click tracking in Resend");
      }
    } catch (error) {
      providerError =
        error instanceof Error ? error.message : "Provider inspection failed.";
      missing.push("Provider verification check");
    }
  }
  return {
    ...settings,
    replyTo,
    signature,
    missing,
    ready: missing.length === 0,
    domainStatus,
    domainName,
    records,
    providerError,
    webhookPath: "/api/webhooks/resend",
    hasApiKey: Boolean(process.env.RESEND_API_KEY),
    hasWebhookSecret: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  };
}
