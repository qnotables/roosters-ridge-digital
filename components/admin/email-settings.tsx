"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { EmailStaffAccess } from "@/components/admin/email-staff-access";
import { emailOperation, type EmailSetup, type WorkspaceData } from "@/lib/email-workspace-types";

export function EmailSettings({ setup, staff, refresh }: { setup: EmailSetup; staff: WorkspaceData["staff"]; refresh: () => Promise<unknown> }) {
  const [sender, setSender] = useState(setup.sender);
  const [staffEmails, setStaffEmails] = useState(setup.staffEmails.join("\n"));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await emailOperation("settings", { sender, staffEmails }); await refresh(); toast.success("Email settings saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to save settings"); }
    finally { setBusy(false); }
  }
  return <section className="flex flex-col gap-5" aria-label="Email configuration">
    <Alert variant={setup.ready ? "default" : "destructive"}><AlertTitle>{setup.ready ? "Ordinary email sending configured" : "Sending needs setup"}</AlertTitle><AlertDescription>{setup.missing.length ? setup.missing.join("; ") : "Resend still checks credentials and sender authorization when sending."}</AlertDescription></Alert>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">Sending credentials</dt><dd>{setup.hasApiKey ? "Configured on server" : "Missing RESEND_API_KEY"}</dd></div>
      <div><dt className="text-muted-foreground">Sender domain</dt><dd>{setup.domainName || "Not configured"} · {setup.domainStatus}</dd></div>
      <div><dt className="text-muted-foreground">Attachments & quote PDFs</dt><dd>{setup.attachmentsReady ? "Private storage credential configured" : "Unavailable: RRD_EMAIL_BLOB_READ_WRITE_TOKEN missing"}</dd></div>
      <div><dt className="text-muted-foreground">Delivery tracking</dt><dd>{setup.deliveryTrackingReady ? "Webhook secret configured; events confirm delivery" : "Unavailable: RESEND_WEBHOOK_SECRET missing (sending still allowed)"}</dd></div>
    </dl>
    {setup.providerError && <p className="text-sm text-muted-foreground">{setup.providerError}</p>}
    <FieldGroup><Field><FieldLabel htmlFor="email-sender">Sender email address</FieldLabel><Input id="email-sender" type="email" value={sender} onChange={e => setSender(e.target.value)} /><FieldDescription>Use your actual authorized address on a verified Resend domain. No address is created automatically.</FieldDescription></Field><Field><FieldLabel htmlFor="email-staff">Approved staff emails</FieldLabel><Textarea id="email-staff" rows={3} value={staffEmails} onChange={e => setStaffEmails(e.target.value)} /><FieldDescription>One per line. The first address is the email administrator; only that verified, signed-in account may change existing settings.</FieldDescription></Field><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</Button></FieldGroup>
    <p className="text-sm text-muted-foreground">Reply-To: {setup.replyTo || "Missing monitored business email"}. <Link href="/admin/profile" className="text-primary underline">Edit business profile & signature</Link>. Client replies are not received in this dashboard.</p>
    <details open={!staff}><summary className="cursor-pointer text-sm font-medium">Staff sign-in & verification</summary><div className="mt-3"><EmailStaffAccess staff={staff} refresh={refresh} /></div></details>
    <details><summary className="cursor-pointer text-sm font-medium">Optional setup & DNS details</summary><div className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
      <p>Attachments only: connect a separate <strong>private</strong> Vercel Blob store with prefix <code>RRD_EMAIL_BLOB</code>, providing <code>RRD_EMAIL_BLOB_READ_WRITE_TOKEN</code>. Keep the public media store and <code>BLOB_READ_WRITE_TOKEN</code> unchanged.</p>
      <p>Delivery tracking only: configure a Resend webhook at your deployed URL + <code>{setup.webhookPath}</code> for sent, delivered, delivery_delayed, bounced, complained, failed, and suppressed. Set its signing secret as <code>RESEND_WEBHOOK_SECRET</code>. No inbound setup is needed.</p>
      <p>Use a Resend key with read access for domain inspection and uncertain-send reconciliation. Disable domain open/click tracking. Preserve existing mailbox MX records; never add a second SPF TXT record.</p>
      {setup.records.map((r, i) => <p key={i} className="break-all font-mono text-xs">{r.type} {r.name}: {r.value} · TTL {r.ttl}{r.priority !== undefined ? ` · Priority ${r.priority}` : ""} · {r.status}</p>)}
      <p>Staff must have a verified individual account and be on the allowlist. Configure the actual preview and production trusted origins in the existing Neon Auth configuration if staff sign-in is rejected.</p>
    </div></details>
  </section>;
}
