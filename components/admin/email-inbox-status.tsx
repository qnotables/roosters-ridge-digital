"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Radio, CheckCircle2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { inboxOperation } from "@/lib/email-inbox-types";
import type { EmailSetup } from "@/lib/email-workspace-types";

export function EmailInboxStatus({ setup, refresh }: { setup: EmailSetup; refresh: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(setup.incomingAddress || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try { await inboxOperation("receiving-settings", { address }); await refresh(); setEditing(false); toast.success("Receiving address saved. Send a dedicated test message to verify ingestion."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save receiving address."); }
    finally { setBusy(false); }
  }
  return <Alert>
    {setup.receivingVerified ? <CheckCircle2 /> : <Radio />}
    <AlertTitle>{setup.receivingVerified ? "Incoming email verified" : setup.incomingAddress ? "Receiving configured · awaiting first incoming message" : "Connect receiving"}</AlertTitle>
    <AlertDescription className="flex flex-col gap-3">
      <p className="break-words">{setup.incomingAddress ? `Inbox address: ${setup.incomingAddress}. ` : "Use the existing Resend provider; no second mail service is needed. "}Outgoing Reply-To: {setup.replyTo || "not configured"}.</p>
      {setup.receivingVerified ? <p>Last successful incoming ingestion: {new Date(setup.lastReceivedAt!).toLocaleString()}. Existing mail routing is unchanged.</p> : <details>
        <summary className="cursor-pointer font-medium text-foreground">Exact remaining setup & verification</summary>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
          {!setup.incomingAddress && <li>Save the existing receiving-enabled business address, or copy your receiving address from Resend → Emails → Receiving. The managed .resend.app option needs no DNS changes.</li>}
          <li>Publish this version so the existing endpoint at <span className="break-all">https://roostersridgedigital.com/api/webhooks/resend</span> runs the inbox code.</li>
          <li>In Resend → Webhooks, confirm this endpoint is enabled and includes <strong>email.received</strong> plus the existing delivery events. Use that same endpoint’s signing secret in RESEND_WEBHOOK_SECRET{setup.hasWebhookSecret ? " (already configured)." : "."}</li>
          <li>Use a full-access Resend API key so the server can retrieve incoming bodies and attachments; a sending-only key is insufficient.</li>
          <li>Send a uniquely named message from a dedicated test mailbox to {setup.incomingAddress || "the saved receiving address"}. Confirm it appears here, reply from the dashboard, and confirm the reply returns to the same conversation.</li>
        </ol>
        <p className="mt-3">No DNS changes are proposed or applied. Existing business-mailbox MX records stay untouched. Historical mailbox mail is not imported automatically.</p>
      </details>}
      <div><Button size="sm" variant="outline" onClick={() => { setEditing(!editing); setAddress(setup.incomingAddress || ""); }}>Manage receiving address</Button></div>
      {editing && <FieldGroup><Field><FieldLabel htmlFor="incoming-address">Resend receiving address</FieldLabel><Input id="incoming-address" type="email" value={address} onChange={e => setAddress(e.target.value)} placeholder="Your existing business address or .resend.app address" /></Field><p>Only already-verified receiving domains are accepted. Changing the address resets incoming verification; it never modifies DNS.</p><Button size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save receiving address"}</Button></FieldGroup>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </AlertDescription>
  </Alert>;
}
