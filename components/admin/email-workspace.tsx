"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Mail,
  Plus,
  FileText,
  Send,
  AlertCircle,
  Settings2,
  Users,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EmailComposer } from "@/components/admin/email-composer";
import { EmailSettings } from "@/components/admin/email-settings";
import { EmailStaffAccess } from "@/components/admin/email-staff-access";
import { EmailTemplates } from "@/components/admin/email-templates";
import { emailFetcher, type WorkspaceData } from "@/lib/email-workspace-types";
import { cn } from "@/lib/utils";

const views = [
  { id: "compose", label: "Compose", icon: Plus },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "sent", label: "Sent", icon: Send },
  { id: "failed", label: "Failed", icon: AlertCircle },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "staff", label: "Staff access", icon: Users },
  { id: "settings", label: "Settings", icon: Settings2 },
];
export function EmailWorkspace({
  draftId,
  leadId,
}: {
  draftId?: string;
  leadId?: string;
}) {
  const { data, error, mutate, isLoading } = useSWR<WorkspaceData>(
    "/api/admin/email",
    emailFetcher,
    { revalidateOnFocus: true },
  );
  const [view, setView] = useState("compose"),
    [selected, setSelected] = useState(draftId || ""),
    [composerKey, setComposerKey] = useState(draftId || "new");
  const [filter, setFilter] = useState("");
  if (error)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Email workspace unavailable</AlertTitle>
          <AlertDescription>
            {error.message}
            <Button variant="outline" onClick={() => mutate()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    );
  if (isLoading || !data)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10" aria-busy="true">
        <p className="text-sm text-muted-foreground">
          Loading your email workspace…
        </p>
      </main>
    );
  const message = data.messages.find((m) => m.id === selected);
  const count = (type: string) =>
    data.messages.filter((m) =>
      type === "drafts"
        ? m.state === "draft"
        : type === "failed"
          ? ["failed", "bounced", "complained"].includes(m.state)
          : ["queued", "accepted", "delivered"].includes(m.state),
    ).length;
  const listed = data.messages
    .filter((m) =>
      view === "drafts"
        ? m.state === "draft"
        : view === "failed"
          ? ["failed", "bounced", "complained"].includes(m.state)
          : ["queued", "accepted", "delivered"].includes(m.state),
    )
    .filter((m) =>
      `${m.subject} ${m.recipients.to.join(" ")} ${m.sender_email || ""}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    );
  function newDraft() {
    setSelected("");
    setComposerKey(`new-${Date.now()}`);
    setView("compose");
  }
  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-7 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Customer communications
          </p>
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Mail className="size-7 text-primary" />
            Email workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thoughtful conversations. Clear sending records.
          </p>
        </div>
        <Button onClick={newDraft}>
          <Plus data-icon="inline-start" />
          New email
        </Button>
      </header>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-4 lg:w-48">
          <nav
            aria-label="Email workspace navigation"
            className="flex flex-wrap gap-1 lg:flex-col"
          >
            {views.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-current={view === id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                  view === id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
                {["drafts", "sent", "failed"].includes(id) && (
                  <span className="ml-auto text-xs">{count(id)}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="hidden rounded-lg border border-border p-3 text-xs leading-6 text-muted-foreground lg:block">
            {data.staff ? (
              <>
                <p className="font-medium text-foreground">Individual sender</p>
                <p className="break-all">{data.staff.email}</p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  Staff sign-in required
                </p>
                <p>Draft now. Sign in individually to send.</p>
              </>
            )}
            <Badge variant="secondary" className="mt-2">
              {data.setup.ready ? "Provider ready" : "Setup required"}
            </Badge>
          </div>
        </aside>
        <section
          className="min-w-0 flex-1"
          aria-label={views.find((v) => v.id === view)?.label}
        >
          {view === "compose" && (
            <EmailComposer
              key={composerKey}
              data={data}
              message={message}
              leadId={leadId}
              refresh={mutate}
              onSaved={setSelected}
            />
          )}{" "}
          {view === "settings" && (
            <EmailSettings setup={data.setup} refresh={mutate} />
          )}{" "}
          {view === "staff" && (
            <EmailStaffAccess staff={data.staff} refresh={mutate} />
          )}{" "}
          {view === "templates" && (
            <EmailTemplates templates={data.templates} refresh={mutate} />
          )}{" "}
          {["drafts", "sent", "failed"].includes(view) && (
            <Card>
              <CardHeader>
                <CardTitle>{views.find((v) => v.id === view)?.label}</CardTitle>
                <CardDescription>
                  {view === "sent"
                    ? "Queued and accepted messages are not necessarily delivered. Provider events confirm delivery."
                    : view === "failed"
                      ? "Failed drafts remain recoverable. Bounced or complained messages are never automatically resent."
                      : "Saved messages are never sent automatically."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <label className="flex flex-col gap-2 text-sm">
                  Search email history
                  <input
                    className="h-10 rounded-md border border-input bg-background px-3"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Subject, recipient, or sending staff"
                  />
                </label>
                {listed.length ? (
                  <ul className="flex flex-col divide-y divide-border">
                    {listed.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left"
                          onClick={() => {
                            setSelected(m.id);
                            setComposerKey(m.id);
                            setView("compose");
                          }}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {m.subject || "Untitled draft"}
                            </p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {m.recipients.to.join(", ") || "No recipient"} ·{" "}
                              {new Date(m.created_at).toLocaleDateString()}
                            </p>
                            {m.sender_email && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Sent by {m.sender_email}
                              </p>
                            )}
                            {m.provider_id && (
                              <p className="mt-1 break-all text-xs text-muted-foreground">
                                Provider ID: {m.provider_id}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={
                              ["failed", "bounced", "complained"].includes(
                                m.state,
                              )
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {m.state}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Mail className="size-8 text-muted-foreground" />
                    <h3 className="font-medium">No {view} emails yet</h3>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {view === "drafts"
                        ? "Save a draft and return to it whenever you are ready."
                        : "Email records will appear here when their status changes."}
                    </p>
                    <Button variant="outline" onClick={newDraft}>
                      Compose an email
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
