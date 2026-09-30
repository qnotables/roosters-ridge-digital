"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { emailOperation, type EmailSetup } from "@/lib/email-workspace-types";

export function EmailSettings({
  setup,
  refresh,
}: {
  setup: EmailSetup;
  refresh: () => Promise<unknown>;
}) {
  const [sender, setSender] = useState(setup.sender);
  const [staffEmails, setStaffEmails] = useState(setup.staffEmails.join("\n"));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await emailOperation("settings", { sender, staffEmails });
      await refresh();
      toast.success("Email settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save settings");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Sender & staff access</CardTitle>
          <CardDescription>
            Dashboard access manages this allowlist. Sending additionally
            requires a verified individual staff account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email-sender">
                Verified-domain sender address
              </FieldLabel>
              <Input
                id="email-sender"
                type="email"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              />
              <FieldDescription>
                Enter the actual sender mailbox. No sender address is inferred
                or created automatically.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="email-staff">
                Approved staff email addresses
              </FieldLabel>
              <Textarea
                id="email-staff"
                value={staffEmails}
                onChange={(e) => setStaffEmails(e.target.value)}
                rows={4}
              />
              <FieldDescription>
                One email per line. The first address is the email
                administrator; after initial setup only that verified, signed-in
                account can change these settings. Staff must verify their email
                before sending.
              </FieldDescription>
            </Field>
            <Button disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save email settings"}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Delivery readiness{" "}
            <Badge variant={setup.ready ? "default" : "secondary"}>
              {setup.ready ? "Ready" : "Setup required"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Drafts are available even when sending is disabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Resend credential</dt>
              <dd>
                {setup.hasApiKey
                  ? "Configured on server"
                  : "Missing RESEND_API_KEY"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Webhook signing secret</dt>
              <dd>
                {setup.hasWebhookSecret
                  ? "Configured on server"
                  : "Missing RESEND_WEBHOOK_SECRET"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sender domain</dt>
              <dd>
                {setup.domainName || "Not configured"} · {setup.domainStatus}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Monitored Reply-To mailbox
              </dt>
              <dd>{setup.replyTo || "Missing in business profile"}</dd>
            </div>
          </dl>
          {setup.missing.length > 0 && (
            <ul className="list-disc pl-5 text-sm leading-7">
              {setup.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {setup.providerError && (
            <p className="text-sm text-destructive">{setup.providerError}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Replies go to the business profile mailbox, not this dashboard.
            There is no dashboard inbox.{" "}
            <Link href="/admin/profile" className="text-primary underline">
              Edit business profile
            </Link>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Exact sender DNS records</CardTitle>
          <CardDescription>
            These values come directly from Resend. Only sending records are
            shown; do not replace your existing inbound-mail MX records or add a
            second SPF TXT record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {setup.records.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Required sender DNS records
                </caption>
                <thead>
                  <tr>
                    {["Type", "Host", "Value", "TTL", "Priority", "Status"].map(
                      (h) => (
                        <th key={h} className="p-2">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {setup.records.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2">{r.type}</td>
                      <td className="p-2 font-mono">{r.name}</td>
                      <td className="max-w-80 break-all p-2 font-mono">
                        {r.value}
                      </td>
                      <td className="p-2">{r.ttl}</td>
                      <td className="p-2">{r.priority ?? "—"}</td>
                      <td className="p-2">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Configure the sender and register its actual domain in Resend to
              retrieve the exact DKIM and SPF records. No DNS values are
              invented here.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Setup checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-6">
            <li>
              Keep <code>RESEND_API_KEY</code> server-only; allow domain read
              access so verification can be checked.
            </li>
            <li>
              Configure the actual sender address above, register its domain in
              Resend, and add the displayed sending DNS records. Preserve
              existing mailbox-delivery records. Disable open and click tracking
              in Resend.
            </li>
            <li>
              Confirm the business-profile email is a monitored mailbox for
              replies.
            </li>
            <li>
              Approve staff addresses above. Staff create an individual
              email/password account, verify their email, and sign in from the
              staff access screen. Configure production and preview trusted
              origins in Neon Auth.
            </li>
            <li>
              Connect a separate private Blob store using the{" "}
              <code>RRD_EMAIL_BLOB</code> environment-variable prefix, providing{" "}
              <code>RRD_EMAIL_BLOB_READ_WRITE_TOKEN</code>. Keep the existing
              public site store and its <code>BLOB_READ_WRITE_TOKEN</code>{" "}
              unchanged. Public stores are rejected; each file is limited to 3
              MB, with five files / 9 MB total.
            </li>
            <li>
              In Resend, add your deployed site URL plus{" "}
              <code>{setup.webhookPath}</code>. Subscribe to sent, delivered,
              delivery_delayed, bounced, complained, failed, and suppressed
              events. Save its signing secret as{" "}
              <code>RESEND_WEBHOOK_SECRET</code> in project Vars. No inbound
              integration is required.
            </li>
            <li>
              Use Resend test addresses for delivery checks. Never send test
              messages to real customers. Limits are five emails per minute and
              50 per day per staff member.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
