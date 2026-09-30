"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EmailEditor } from "@/components/admin/email-editor";
import {
  emailOperation,
  type EmailTemplate,
} from "@/lib/email-workspace-types";

export function EmailTemplates({
  templates,
  refresh,
}: {
  templates: EmailTemplate[];
  refresh: () => Promise<unknown>;
}) {
  const [selected, setSelected] = useState(templates[0]?.id || "");
  const template = templates.find((t) => t.id === selected);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reusable email templates</CardTitle>
        <CardDescription>
          Placeholders are resolved in the composer. Saving a template does not
          send an email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="edit-template">Template</FieldLabel>
          <select
            id="edit-template"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        {template && (
          <TemplateForm
            key={template.id}
            template={template}
            refresh={refresh}
          />
        )}
      </CardContent>
    </Card>
  );
}
function TemplateForm({
  template,
  refresh,
}: {
  template: EmailTemplate;
  refresh: () => Promise<unknown>;
}) {
  const [subject, setSubject] = useState(template.subject),
    [html, setHtml] = useState(template.html),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await emailOperation("template", { id: template.id, subject, html });
      await refresh();
      toast.success("Template saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save template");
    } finally {
      setBusy(false);
    }
  }
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="template-subject">Template subject</FieldLabel>
        <Input
          id="template-subject"
          value={subject}
          maxLength={200}
          onChange={(e) => setSubject(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>Template message</FieldLabel>
        <EmailEditor html={html} onChange={setHtml} />
      </Field>
      <p className="text-sm text-muted-foreground">
        {
          "Supported placeholders include {{customer_name}}, {{company}}, {{project_name}}, and {{estimate_number}}. Any unresolved placeholder blocks sending."
        }
      </p>
      <Button onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save template"}
      </Button>
    </FieldGroup>
  );
}
