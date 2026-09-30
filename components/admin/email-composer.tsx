"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Eye, Paperclip, Send, Save, Trash2, FileText } from "lucide-react";
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
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmailEditor } from "@/components/admin/email-editor";
import {
  emailFetcher,
  emailOperation,
  type EmailMessage,
  type EmailFile,
  type WorkspaceData,
} from "@/lib/email-workspace-types";

const addresses = (value: string) =>
  value
    .split(/[;,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
const textFromHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.innerText || doc.body.textContent || "";
};
const escaped = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function EmailComposer({
  data,
  message,
  leadId,
  refresh,
  onSaved,
}: {
  data: WorkspaceData;
  message?: EmailMessage;
  leadId?: string;
  refresh: () => Promise<WorkspaceData | undefined>;
  onSaved: (id: string) => void;
}) {
  const lead = data.leads.find((l) => l.id === (message?.lead_id || leadId));
  const [id, setId] = useState(message?.id || "");
  const [to, setTo] = useState(
    message?.recipients.to.join(", ") || lead?.email || "",
  );
  const [cc, setCc] = useState(message?.recipients.cc.join(", ") || "");
  const [bcc, setBcc] = useState(message?.recipients.bcc.join(", ") || "");
  const [selectedLead, setSelectedLead] = useState(
    message?.lead_id || lead?.id || "",
  );
  const [project, setProject] = useState(message?.project_name || "");
  const [subject, setSubject] = useState(message?.subject || "");
  const [html, setHtml] = useState(
    message?.html ||
      `<p>Hello ${lead ? escaped(lead.first_name) : "{{customer_name}}"},</p><p></p>${data.setup.signature}`,
  );
  const [plain, setPlain] = useState(message?.plain_text || "");
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const locked = Boolean(
    (message && !["draft", "failed"].includes(message.state)) ||
    (message?.state === "failed" && !message.retry_safe),
  );
  const { data: attachmentData, mutate: refreshFiles } = useSWR<{
    files: EmailFile[];
  }>(id ? `/api/admin/email/attachments?messageId=${id}` : null, emailFetcher);
  const files = attachmentData?.files || [];
  const missing = [
    ...new Set(`${subject} ${html} ${plain}`.match(/\{\{[^{}]+\}\}/g) || []),
  ];
  const canSend =
    data.setup.ready &&
    Boolean(data.staff) &&
    missing.length === 0 &&
    (!message?.estimate_id ||
      files.some((f) => f.estimate_id === message.estimate_id)) &&
    (!locked || message?.state === "queued");
  async function saved() {
    if (locked) return id;
    const result = await emailOperation("draft", {
      draft: {
        id: id || undefined,
        recipients: {
          to: addresses(to),
          cc: addresses(cc),
          bcc: addresses(bcc),
        },
        subject,
        html,
        plainText: plain,
        leadId: selectedLead || null,
        projectName: project,
      },
    });
    setId(result.id);
    onSaved(result.id);
    return String(result.id);
  }
  async function act(operation: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await operation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Email operation failed");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function chooseLead(value: string) {
    setSelectedLead(value);
    const chosen = data.leads.find((l) => l.id === value);
    if (chosen) setTo(chosen.email);
  }
  function useTemplate(templateId: string) {
    const template = data.templates.find((t) => t.id === templateId);
    if (!template) return;
    const chosen = data.leads.find((l) => l.id === selectedLead);
    const replacements: Record<string, string> = {
      customer_name: chosen?.first_name || "",
      company: chosen?.business_name || "",
      project_name: project,
    };
    const fill = (source: string, rich: boolean) =>
      source.replace(/\{\{([^{}]+)\}\}/g, (match, key) =>
        replacements[key]
          ? rich
            ? escaped(replacements[key])
            : replacements[key]
          : match,
      );
    const newHtml = `${fill(template.html, true)}${data.setup.signature}`;
    setSubject(fill(template.subject, false));
    setHtml(newHtml);
    setPlain(textFromHtml(newHtml));
  }
  function resolvePlaceholders() {
    const replace = (source: string, rich: boolean) =>
      source.replace(/\{\{([^{}]+)\}\}/g, (match, key) =>
        values[key]?.trim()
          ? rich
            ? escaped(values[key].trim())
            : values[key].trim()
          : match,
      );
    setSubject(replace(subject, false));
    setHtml(replace(html, true));
    setPlain(replace(plain, false));
  }
  async function showPreview() {
    await act(async () => {
      const draftId = await saved();
      const latest = await refresh();
      const sanitized = latest?.messages.find((m) => m.id === draftId);
      setPreviewHtml(sanitized?.html || message?.html || "");
      await refreshFiles();
      setPreview(true);
    });
  }
  async function send() {
    await act(async () => {
      try {
        const result = await emailOperation("send", { id });
        toast.success(
          result.state === "accepted"
            ? "Accepted by Resend. Delivery is not yet confirmed."
            : `Message status: ${result.state}`,
        );
        setPreview(false);
      } finally {
        await refresh();
      }
    });
  }
  async function upload(file: File) {
    await act(async () => {
      const draftId = await saved();
      const body = new FormData();
      body.set("messageId", draftId);
      body.set("file", file);
      const response = await fetch("/api/admin/email/attachments", {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refreshFiles();
      await refresh();
      toast.success("Private attachment added");
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {message
            ? message.state === "draft"
              ? "Continue draft"
              : "Message details"
            : "Compose email"}
        </CardTitle>
        <CardDescription>
          One customer conversation. No tracking pixels, no bulk campaigns.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!data.setup.ready && (
          <Alert>
            <AlertTitle>Drafts are available · sending is disabled</AlertTitle>
            <AlertDescription>
              Complete sender verification and webhook setup in Email settings.
            </AlertDescription>
          </Alert>
        )}
        {!data.staff && (
          <Alert>
            <AlertTitle>Individual staff sign-in required to send</AlertTitle>
            <AlertDescription>
              Use Staff access to sign in with a verified, approved account.
              Dashboard access alone cannot send.
            </AlertDescription>
          </Alert>
        )}
        {message?.last_error && (
          <Alert variant="destructive">
            <AlertTitle>Send attempt needs attention</AlertTitle>
            <AlertDescription>{message.last_error}</AlertDescription>
          </Alert>
        )}
        {locked && (
          <p className="text-sm text-muted-foreground">
            Message content is locked to preserve the sending record.{" "}
            {message?.state === "queued"
              ? "Retry only this unchanged attempt within 23 hours."
              : "Create a new draft for another email."}
          </p>
        )}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email-lead">
              Existing lead / customer
            </FieldLabel>
            <select
              id="email-lead"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedLead}
              disabled={locked}
              onChange={(e) => chooseLead(e.target.value)}
            >
              <option value="">Enter recipient manually</option>
              {data.leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.first_name} {l.last_name} · {l.business_name || l.email}
                </option>
              ))}
            </select>
            <FieldDescription>
              Customers are selected from existing leads; emails appear in the
              linked lead history.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="email-to">To</FieldLabel>
            <Input
              id="email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={locked}
              placeholder="Customer email address"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="email-cc">CC</FieldLabel>
              <Input
                id="email-cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                disabled={locked}
                placeholder="Optional · comma separated"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email-bcc">BCC</FieldLabel>
              <Input
                id="email-bcc"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                disabled={locked}
                placeholder="Optional · comma separated"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="email-project">
                Related project name
              </FieldLabel>
              <Input
                id="email-project"
                value={project}
                disabled={locked}
                onChange={(e) => setProject(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email-template">
                Start from a template
              </FieldLabel>
              <select
                id="email-template"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
                disabled={locked}
                onChange={(e) => useTemplate(e.target.value)}
              >
                <option value="">Choose a template</option>
                {data.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="email-subject">Subject</FieldLabel>
            <Input
              id="email-subject"
              maxLength={200}
              value={subject}
              disabled={locked}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Message & RRD signature</FieldLabel>
            <EmailEditor
              html={html}
              disabled={locked}
              onChange={(h, t) => {
                setHtml(h);
                setPlain(t);
              }}
            />
            <FieldDescription>
              Signature is populated from the saved business profile and can be
              edited in this draft.
            </FieldDescription>
          </Field>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Plain-text alternative
            </summary>
            <Field className="mt-3">
              <FieldLabel htmlFor="email-plain">Plain-text message</FieldLabel>
              <Textarea
                id="email-plain"
                rows={7}
                value={plain}
                disabled={locked}
                onChange={(e) => setPlain(e.target.value)}
                placeholder="Generated from the rich-text message when saved if left empty."
              />
            </Field>
          </details>
        </FieldGroup>
        {missing.length > 0 && !locked && (
          <section
            className="flex flex-col gap-3 rounded-lg border border-border p-4"
            aria-label="Unresolved template placeholders"
          >
            <h3 className="text-sm font-semibold">
              Resolve template placeholders before sending
            </h3>
            <FieldGroup>
              {missing.map((token) => {
                const key = token.slice(2, -2);
                return (
                  <Field key={key}>
                    <FieldLabel htmlFor={`placeholder-${key}`}>
                      {key.replaceAll("_", " ")}
                    </FieldLabel>
                    <Input
                      id={`placeholder-${key}`}
                      value={values[key] || ""}
                      onChange={(e) =>
                        setValues({ ...values, [key]: e.target.value })
                      }
                    />
                  </Field>
                );
              })}
            </FieldGroup>
            <Button size="sm" variant="outline" onClick={resolvePlaceholders}>
              Apply placeholder values
            </Button>
          </section>
        )}
        <section className="flex flex-col gap-3" aria-label="Email attachments">
          <h3 className="text-sm font-semibold">Attachments</h3>
          <p className="text-xs text-muted-foreground">
            Private files only · PDF, PNG, JPEG, TXT · 3 MB per file · 9 MB
            total
          </p>
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <a
                href={`/api/admin/email/attachments?id=${f.id}`}
                className="flex min-w-0 items-center gap-2 text-sm underline underline-offset-4"
              >
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{f.name}</span>
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">
                {Math.ceil(f.size / 1024)} KB
              </span>
              {!locked && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${f.name}`}
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const response = await fetch(
                        `/api/admin/email/attachments?id=${f.id}`,
                        { method: "DELETE" },
                      );
                      if (!response.ok)
                        throw new Error((await response.json()).error);
                      await refreshFiles();
                    })
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          {message?.estimate_id &&
            !files.some((f) => f.estimate_id === message.estimate_id) && (
              <Alert variant="destructive">
                <AlertTitle>Customer estimate PDF is missing</AlertTitle>
                <AlertDescription>
                  Sending is blocked. Configure private storage, then attach the
                  saved customer PDF.
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || locked}
                    onClick={() =>
                      act(async () => {
                        await emailOperation("attach-estimate", { id });
                        await refreshFiles();
                        toast.success("Customer estimate PDF attached");
                      })
                    }
                  >
                    Attach saved estimate PDF
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          {!locked && (
            <Field>
              <FieldLabel htmlFor="email-file">
                <Paperclip className="size-4" /> Add attachment
              </FieldLabel>
              <Input
                id="email-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                  e.target.value = "";
                }}
              />
            </Field>
          )}
        </section>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Replies go to{" "}
          {data.setup.replyTo || "the configured business mailbox"}.<br />
          {data.staff
            ? `Sending staff: ${data.staff.email}`
            : "No individual staff account signed in."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!locked && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await saved();
                  await refresh();
                  toast.success("Draft saved securely");
                })
              }
            >
              <Save data-icon="inline-start" />
              Save draft
            </Button>
          )}
          <Button variant="outline" disabled={busy} onClick={showPreview}>
            <Eye data-icon="inline-start" />
            Preview
          </Button>
          <Button disabled={busy || !canSend} onClick={showPreview}>
            <Send data-icon="inline-start" />
            {message?.state === "queued"
              ? "Review unchanged retry"
              : "Review & send"}
          </Button>
        </div>
      </CardFooter>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review customer email</DialogTitle>
            <DialogDescription>
              Nothing has been sent. Check the recipients and final attachments
              before explicitly sending.
            </DialogDescription>
          </DialogHeader>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="inline font-medium">To: </dt>
              <dd className="inline">{to || "Missing recipient"}</dd>
            </div>
            {cc && (
              <div>
                <dt className="inline font-medium">CC: </dt>
                <dd className="inline">{cc}</dd>
              </div>
            )}
            {bcc && (
              <div>
                <dt className="inline font-medium">BCC: </dt>
                <dd className="inline">{bcc}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-medium">Subject: </dt>
              <dd className="inline">{subject}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Attachments: </dt>
              <dd className="inline">
                {files.length ? files.map((f) => f.name).join(", ") : "None"}
              </dd>
            </div>
          </dl>
          <iframe
            title="Sanitized customer email preview"
            sandbox=""
            className="h-80 w-full rounded-md border border-border bg-white"
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px/1.7 system-ui;color:#172235;padding:16px;overflow-wrap:anywhere}a{color:#172235}</style></head><body>${previewHtml}</body></html>`}
          />
          <p className="text-xs text-muted-foreground">
            Resend acceptance is not confirmation of delivery. Delivery status
            is recorded from authenticated provider events.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(false)}>
              Back to message
            </Button>
            <Button disabled={busy || !canSend} onClick={send}>
              <Send data-icon="inline-start" />
              {busy
                ? "Sending…"
                : message?.state === "queued"
                  ? "Retry same send attempt"
                  : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
