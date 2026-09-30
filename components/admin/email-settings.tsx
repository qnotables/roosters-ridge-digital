"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { emailOperation, type EmailSetup } from "@/lib/email-workspace-types";

export function EmailSettings({ setup, refresh }: { setup: EmailSetup; refresh: () => Promise<unknown> }) {
  const [sender, setSender] = useState(setup.sender);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await emailOperation("settings", { sender });
      await refresh();
      toast.success("Sender address saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save sender");
    } finally {
      setBusy(false);
    }
  }
  return <section className="flex flex-col gap-5" aria-label="Email configuration">
    <Alert variant={setup.ready ? "default" : "destructive"}>
      <AlertTitle>{setup.ready ? "Ready to send" : "Sender setup needed"}</AlertTitle>
      <AlertDescription>{setup.missing.length ? setup.missing.join("; ") : `Emails send from ${setup.sender}. Your existing dashboard access is all you need.`}</AlertDescription>
    </Alert>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email-sender">Sender email address</FieldLabel>
          <Input id="email-sender" type="email" required value={sender} onChange={event => setSender(event.target.value)} aria-describedby="email-sender-help" />
          <FieldDescription id="email-sender-help">Use your single sending address on a verified Resend domain. No staff accounts, passwords, or email verification codes are needed here.</FieldDescription>
        </Field>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save sender"}</Button>
      </FieldGroup>
    </form>
    <p className="text-sm text-muted-foreground">Replies go to {setup.replyTo || setup.sender || "your business mailbox"}. <Link href="/admin/profile" className="text-primary underline">Edit reply address & signature</Link>.</p>
    <details>
      <summary className="cursor-pointer text-sm font-medium">Provider & optional features</summary>
      <div className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
        <p>Sending credentials: {setup.hasApiKey ? "configured on server" : "missing RESEND_API_KEY"}.</p>
        <p>Sender domain: {setup.domainName || "save a sender address"} · {setup.domainStatus}.</p>
        {setup.providerError && <p>{setup.providerError}</p>}
        <p>Attachments: {setup.attachmentsReady ? "available" : "not configured; not needed for a plain email"}.</p>
        <p>Delivery tracking: {setup.deliveryTrackingReady ? "configured" : "optional; sending is still allowed"}.</p>
        {setup.records.map((record, index) => <p key={index} className="break-all font-mono text-xs">{record.type} {record.name}: {record.value} · {record.status}</p>)}
      </div>
    </details>
  </section>;
}
