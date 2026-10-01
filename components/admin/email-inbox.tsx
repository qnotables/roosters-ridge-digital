"use client";
import { useState } from "react";
import useSWR from "swr";
import { Inbox, Search, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { emailFetcher } from "@/lib/email-workspace-types";
import { inboxOperation, type InboxList } from "@/lib/email-inbox-types";
import { EmailConversation } from "@/components/admin/email-conversation";

export function EmailInbox({ folder, openDraft }: { folder: "inbox" | "sent" | "archive"; openDraft: (id: string) => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(0);
  const [feedback, setFeedback] = useState("");
  const { data, error, isLoading, mutate } = useSWR<InboxList>(`/api/admin/email/inbox?folder=${folder}&search=${encodeURIComponent(search)}&page=${page}`, emailFetcher, { refreshInterval: 30_000 });
  async function select(id: string) {
    setSelected(id); setFeedback("");
    try { await inboxOperation("read", { conversationId: id }); await mutate(); }
    catch (e) { setFeedback(e instanceof Error ? e.message : "Unable to mark read."); }
  }
  return <section className="mt-4 flex flex-col gap-4" aria-label={`${folder} conversations`}>
    <div className="flex items-end gap-3"><Field className="min-w-0 flex-1"><FieldLabel htmlFor={`search-${folder}`}><Search className="size-4" />Search conversations</FieldLabel><Input id={`search-${folder}`} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Sender, recipient, subject, or message text" /></Field><Button variant="outline" size="icon" aria-label="Refresh conversations" onClick={() => mutate()}><RefreshCw /></Button></div>
    {feedback && <Alert variant="destructive"><AlertTitle>Inbox update failed</AlertTitle><AlertDescription>{feedback}</AlertDescription></Alert>}
    <div className="grid min-h-96 grid-cols-1 overflow-hidden rounded-xl border border-border bg-card text-card-foreground lg:grid-cols-[minmax(250px,0.85fr)_minmax(0,1.6fr)]">
      <div className={cn("min-w-0 border-border lg:border-r", selected && "hidden lg:block")}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-semibold capitalize">{folder}</h2>{folder === "inbox" && <Badge variant="secondary">{data?.unread || 0} unread</Badge>}</div>
        {error ? <Alert variant="destructive" className="m-3 w-auto"><AlertTitle>Could not load conversations</AlertTitle><AlertDescription>{error.message}<Button size="sm" variant="outline" onClick={() => mutate()}>Retry</Button></AlertDescription></Alert> : isLoading ? <div aria-busy="true" aria-label="Loading conversations" className="flex flex-col gap-4 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : data?.conversations.length ? <ul className="divide-y divide-border">{data.conversations.map(c => <li key={c.conversation_id}>
          <button type="button" aria-pressed={selected === c.conversation_id} className={cn("flex w-full flex-col gap-1 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary", selected === c.conversation_id && "bg-muted")} onClick={() => select(c.conversation_id)}>
            <div className="flex w-full items-center justify-between gap-2"><span className={cn("truncate text-sm", c.unread > 0 && "font-semibold")}>{c.direction === "inbound" ? c.sender_email : c.recipients.to.join(", ")}</span><time className="shrink-0 text-xs text-muted-foreground" dateTime={c.last_at}>{new Date(c.last_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>
            <div className="flex items-center gap-2"><p className={cn("min-w-0 truncate text-sm", c.unread > 0 && "font-semibold")}>{c.subject || "(No subject)"}</p>{c.unread > 0 && <Badge variant="default">Unread</Badge>}</div>
            <p className="truncate text-xs text-muted-foreground">{c.snippet || "No plain-text preview"}</p><span className="text-xs text-muted-foreground">{c.message_count} {c.message_count === 1 ? "message" : "messages"}{c.direction === "outbound" ? ` · ${c.state === "accepted" ? "Accepted by provider" : c.state}` : ""}</span>
          </button>
        </li>)}</ul> : <Empty><EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>{search ? "No matches" : "No conversations yet"}</EmptyTitle><EmptyDescription>{search ? "Try another name, address, or phrase." : folder === "inbox" ? "Incoming messages appear here after the receiving webhook processes them." : folder === "archive" ? "Archived conversations are kept here, not deleted." : "Sent messages and their replies appear together here."}</EmptyDescription></EmptyHeader></Empty>}
        <div className="flex items-center justify-between gap-2 border-t border-border p-3"><Button size="sm" variant="ghost" disabled={page === 0 || isLoading} onClick={() => setPage(p => p-1)}>Previous</Button><span className="text-xs text-muted-foreground">Page {page+1}</span><Button size="sm" variant="ghost" disabled={!data?.hasMore || isLoading} onClick={() => setPage(p => p+1)}>Next</Button></div>
      </div>
      <div className={cn("min-w-0", !selected && "hidden lg:block")}>
        {selected ? <><div className="p-3 lg:hidden"><Button size="sm" variant="ghost" onClick={() => setSelected("")}><ArrowLeft data-icon="inline-start" />Back to conversations</Button></div><EmailConversation key={selected} id={selected} openDraft={openDraft} refreshList={mutate} onArchived={() => { setSelected(""); void mutate(); }} /></> : <Empty className="min-h-96"><EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>Select a conversation</EmptyTitle><EmptyDescription>Read the thread, download attachments, or follow up on a quote.</EmptyDescription></EmptyHeader></Empty>}
      </div>
    </div>
  </section>;
}
