"use client";

import { useState } from "react";
import useSWR from "swr";
import { Mail, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmailComposer } from "@/components/admin/email-composer";
import { EmailSettings } from "@/components/admin/email-settings";
import { EmailInbox } from "@/components/admin/email-inbox";
import { EmailInboxStatus } from "@/components/admin/email-inbox-status";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { emailFetcher, type WorkspaceData } from "@/lib/email-workspace-types";

export function EmailWorkspace({ draftId, leadId }: { draftId?: string; leadId?: string }) {
  const { data, error, mutate, isLoading } = useSWR<WorkspaceData>("/api/admin/email", emailFetcher);
  const [view, setView] = useState(draftId || leadId ? "compose" : "inbox");
  const [selected, setSelected] = useState(draftId || "");
  const [composerKey, setComposerKey] = useState(draftId || "new");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  if (error) return <main className="mx-auto max-w-5xl px-4 py-10"><Alert variant="destructive"><AlertTitle>Email unavailable</AlertTitle><AlertDescription>{error.message}<Button variant="outline" onClick={() => mutate()}>Retry</Button></AlertDescription></Alert></main>;
  if (isLoading || !data) return <main className="mx-auto max-w-5xl px-4 py-10" aria-busy="true">Loading email…</main>;
  const drafts = data.messages.filter(m => m.state === "draft" || (m.state === "failed" && m.retry_safe));
  const sent = data.messages.filter(m => m.state !== "draft" && !(m.state === "failed" && m.retry_safe)).filter(m => `${m.subject} ${m.recipients.to.join(" ")}`.toLowerCase().includes(filter.toLowerCase()));
  function openMessage(id: string) { setSelected(id); setComposerKey(id || `new-${Date.now()}`); setView("compose"); }
  async function openReply(id: string) { await mutate(); openMessage(id); }
  return <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="flex items-center gap-3 text-3xl font-semibold"><Mail className="size-7 text-primary" />Email</h1><p className="mt-2 text-sm text-muted-foreground">Everyday client conversations, saved drafts, and quote follow-ups.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 data-icon="inline-start" />Email settings</Button><Button onClick={() => openMessage("")}><Plus data-icon="inline-start" />New email</Button></div>
    </header>
    <EmailInboxStatus setup={data.setup} refresh={mutate} />
    <Tabs value={view} onValueChange={value => setView(String(value))}>
      <div className="overflow-x-auto"><TabsList><TabsTrigger value="inbox">Inbox</TabsTrigger><TabsTrigger value="sent">Sent</TabsTrigger><TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger><TabsTrigger value="archive">Archive</TabsTrigger><TabsTrigger value="compose">Compose</TabsTrigger></TabsList></div>
      <TabsContent value="inbox"><EmailInbox key="inbox" folder="inbox" openDraft={openReply} /></TabsContent>
      <TabsContent value="archive"><EmailInbox key="archive" folder="archive" openDraft={openReply} /></TabsContent>
      <TabsContent value="drafts"><Card className="mt-4"><CardHeader><CardTitle>Drafts</CardTitle><CardDescription>Saved messages and replies. Nothing is sent until you choose Send.</CardDescription></CardHeader><CardContent>{drafts.length ? <ul className="divide-y divide-border">{drafts.map(m => <li key={m.id}><button type="button" className="flex w-full flex-col gap-1 py-4 text-left" onClick={() => openMessage(m.id)}><span className="font-medium">{m.subject || "Untitled draft"}</span><span className="break-all text-sm text-muted-foreground">{m.recipients.to.join(", ") || "No recipient"}{m.reply_to_message_id ? " · Threaded reply" : ""}</span></button></li>)}</ul> : <Empty><EmptyHeader><EmptyTitle>No saved drafts</EmptyTitle><EmptyDescription>Start a new email or reply to a conversation.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card></TabsContent>
      <TabsContent value="compose" keepMounted className="data-[hidden]:hidden">
        <div className="flex flex-col gap-4 pt-4">
          <Field><FieldLabel htmlFor="saved-email-draft">Saved drafts ({drafts.length})</FieldLabel><select id="saved-email-draft" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={drafts.some(m => m.id === selected) ? selected : ""} onChange={e => openMessage(e.target.value)}><option value="">New message / choose a draft</option>{drafts.map(m => <option key={m.id} value={m.id}>{m.subject || "Untitled draft"} · {m.recipients.to.join(", ") || "No recipient"}{m.state === "failed" ? " · Send failed" : ""}</option>)}</select></Field>
          <EmailComposer key={composerKey} data={data} message={data.messages.find(m => m.id === selected)} leadId={leadId} refresh={mutate} onSaved={setSelected} onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </TabsContent>
      <TabsContent value="sent"><EmailInbox key="sent" folder="sent" openDraft={openReply} /><details className="mt-5"><summary className="cursor-pointer text-sm font-medium">Delivery history & send attempts</summary><Card className="mt-4"><CardHeader><CardTitle>Sent & send attempts</CardTitle><CardDescription>Accepted means Resend accepted the request, not delivered. {data.setup.deliveryTrackingReady ? "Verified provider events confirm delivery." : "Delivery webhooks are not configured; delivery tracking is unavailable."}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
        <Field><FieldLabel htmlFor="email-history-search">Search messages</FieldLabel><Input id="email-history-search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Subject or recipient" /></Field>
        {sent.length ? <ul className="flex flex-col divide-y divide-border">{sent.map(m => <li key={m.id}><button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left" onClick={() => openMessage(m.id)}><div className="min-w-0"><p className="truncate font-medium">{m.subject || "Untitled message"}</p><p className="mt-1 break-all text-xs text-muted-foreground">{m.recipients.to.join(", ")} · {new Date(m.created_at).toLocaleDateString()}</p>{m.last_error && <p className="mt-1 text-xs text-destructive">{m.last_error}</p>}</div><Badge variant={["failed", "bounced", "complained"].includes(m.state) ? "destructive" : "secondary"}>{m.state === "queued" ? "Acceptance uncertain" : m.state === "accepted" ? "Accepted by provider" : m.state}</Badge></button></li>)}</ul> : <p className="py-10 text-center text-muted-foreground">No send attempts yet. Saved drafts stay on Compose.</p>}
      </CardContent></Card></details></TabsContent>
    </Tabs>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Email settings</DialogTitle><DialogDescription>One sender address. No separate staff login.</DialogDescription></DialogHeader><EmailSettings setup={data.setup} refresh={mutate} /></DialogContent></Dialog>
  </main>;
}
