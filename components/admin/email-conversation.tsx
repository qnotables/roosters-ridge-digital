"use client";
import { useState, useRef } from "react";
import useSWR from "swr";
import { Archive, Reply, Mail, MailOpen, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { emailFetcher } from "@/lib/email-workspace-types";
import { inboxOperation, type InboxDetail } from "@/lib/email-inbox-types";

type Props = { id: string; openDraft: (id: string) => Promise<void>; refreshList: () => Promise<unknown>; onArchived: () => void };
export function EmailConversation(props: Props) {
  const { data, error, isLoading, mutate } = useSWR<InboxDetail>(`/api/admin/email/inbox?conversationId=${props.id}`, emailFetcher, { refreshInterval: 30_000 });
  if (error) return <Alert variant="destructive" className="m-4 w-auto"><AlertTitle>Message unavailable</AlertTitle><AlertDescription>{error.message}<Button size="sm" variant="outline" onClick={() => mutate()}>Retry</Button></AlertDescription></Alert>;
  if (isLoading || !data) return <div aria-busy="true" aria-label="Loading message" className="flex flex-col gap-4 p-6"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-32 w-full" /></div>;
  return <ConversationDetail {...props} data={data} refreshDetail={mutate} />;
}
function ConversationDetail({ id, data, openDraft, refreshList, refreshDetail, onArchived }: Props & { data: InboxDetail; refreshDetail: () => Promise<unknown> }) {
  const latest = data.messages.at(-1)!;
  const related = [...data.messages].reverse().find(m => m.direction === "inbound") || latest;
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState("");
  const [associating, setAssociating] = useState(false);
  const [lead, setLead] = useState(related.lead_id || "");
  const [quote, setQuote] = useState(related.estimate_id || "");
  const unread = data.messages.some(m => m.direction === "inbound" && !m.read_at);
  async function act(action: string, values: Record<string,unknown> = {}) {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try {
      const result = await inboxOperation(action, { conversationId: id, ...values });
      if (action === "reply") await openDraft(result.id);
      else { await Promise.all([refreshList(), refreshDetail()]); if (["archive","restore"].includes(action)) onArchived(); }
      if (action === "associate") { setAssociating(false); toast.success("Saved associations."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Conversation update failed."); }
    finally { working.current = false; setBusy(false); }
  }
  return <section className="flex flex-col gap-5 p-4 sm:p-6" aria-label="Conversation detail">
    <header className="flex flex-col gap-3"><h2 className="break-words text-xl font-semibold">{data.messages[0].subject || "(No subject)"}</h2><div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(unread ? "read" : "unread")}>{unread ? <MailOpen data-icon="inline-start" /> : <Mail data-icon="inline-start" />}{unread ? "Mark read" : "Mark unread"}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(latest.archived ? "restore" : "archive")}><Archive data-icon="inline-start" />{latest.archived ? "Restore" : "Archive"}</Button>
      {data.messages.some(m => m.direction === "inbound") && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAssociating(!associating)}><Link2 data-icon="inline-start" />Client / quote</Button>}
    </div>
    {(related.lead_id || related.estimate_id) && <div className="flex flex-wrap gap-2">{related.lead_id && <Badge variant="secondary">Client: {data.leads.find(l => l.id === related.lead_id)?.business_name || data.leads.find(l => l.id === related.lead_id)?.first_name || "Saved client"}</Badge>}{related.estimate_id && <Badge variant="secondary">Quote: {data.quotes.find(q => q.id === related.estimate_id)?.estimate_number || "Saved quote"}</Badge>}</div>}
    </header>
    {error && <Alert variant="destructive"><AlertTitle>Action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {associating && <FieldGroup><Field><FieldLabel htmlFor="conversation-client">Saved client</FieldLabel><select id="conversation-client" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={lead} onChange={e => setLead(e.target.value)}><option value="">No association</option>{data.leads.map(l => <option key={l.id} value={l.id}>{l.business_name || `${l.first_name} ${l.last_name || ""}`} · {l.email}</option>)}</select></Field><Field><FieldLabel htmlFor="conversation-quote">Saved quote</FieldLabel><select id="conversation-quote" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={quote} onChange={e => setQuote(e.target.value)}><option value="">No association</option>{data.quotes.map(q => <option key={q.id} value={q.id}>{q.estimate_number} · {q.project_name}</option>)}</select></Field><p className="text-xs text-muted-foreground">Choose explicitly. Matching a sender or subject never assigns a quote.</p><Button size="sm" disabled={busy} onClick={() => act("associate", { leadId: lead || null, estimateId: quote || null })}>Save associations</Button></FieldGroup>}
    <p className="text-xs text-muted-foreground">Email is untrusted. Scripts, remote images, and active content are blocked. Downloaded attachments are not virus-scanned; open only files you trust.</p>
    {data.hasOlder && <p role="status" className="text-sm text-muted-foreground">Showing the latest 100 messages. Older messages are preserved and remain searchable.</p>}
    <div className="flex flex-col gap-4">{data.messages.map(message => <article key={message.id} className="min-w-0 rounded-lg border border-border p-4">
      <header className="mb-4 flex flex-col gap-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all text-sm font-medium">{message.sender_email || "RRD"}</p><Badge variant="secondary">{message.direction === "inbound" ? "Received" : message.state === "accepted" ? "Accepted by provider" : message.state}</Badge></div><p className="break-all text-xs text-muted-foreground">To: {message.recipients.to.join(", ")}{message.recipients.cc.length ? ` · CC: ${message.recipients.cc.join(", ")}` : ""}{message.recipients.bcc.length ? ` · BCC: ${message.recipients.bcc.join(", ")}` : ""}</p><time className="text-xs text-muted-foreground" dateTime={message.received_at || message.accepted_at || message.created_at}>{new Date(message.received_at || message.accepted_at || message.created_at).toLocaleString()}</time></header>
      <MessageBody html={message.html} text={message.plain_text} />
      {message.last_error && <p role="status" className="mt-3 text-sm text-destructive">{message.last_error}</p>}
      {data.files.filter(f => f.message_id === message.id).length > 0 && <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-3" aria-label="Attachments">{data.files.filter(f => f.message_id === message.id).map(f => <li key={f.id} className="flex flex-col gap-1 text-sm">{f.blocked_reason ? <><span className="break-all">{f.name}</span><p className="text-xs text-muted-foreground">{f.blocked_reason}</p></> : <a className="flex items-center gap-2 break-all underline underline-offset-4" href={`/api/admin/email/${f.incoming ? "inbox/" : ""}attachments?id=${f.id}`}><Download className="size-4 shrink-0" />{f.name} <span className="shrink-0 text-xs text-muted-foreground">({Math.ceil(f.size / 1000)} KB)</span></a>}</li>)}</ul>}
      <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || !message.rfc_message_id || (message.direction === "outbound" && !message.provider_id)} onClick={() => act("reply", { messageId: message.id, draftId: crypto.randomUUID() })}><Reply data-icon="inline-start" />{busy ? "Working…" : "Reply"}</Button>{message.direction === "outbound" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => openDraft(message.id)}>View send details</Button>}</div>
      {!message.rfc_message_id && <p className="mt-2 text-xs text-muted-foreground">Threaded reply unavailable until the original Message-ID is known.</p>}
    </article>)}</div>
  </section>;
}
function MessageBody({ html, text }: { html: string; text: string }) {
  const [formatted, setFormatted] = useState(false);
  return <div className="flex flex-col gap-3"><div>{html && text && <Button size="xs" variant="ghost" onClick={() => setFormatted(!formatted)}>{formatted ? "Plain text" : "Show safe formatting"}</Button>}</div>{formatted || !text ? <div className="break-words text-sm leading-relaxed [&_p]:mb-3 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>}</div>;
}
