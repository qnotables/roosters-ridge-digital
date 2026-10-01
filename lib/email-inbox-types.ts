import type { EmailMessage, EmailLead } from "@/lib/email-workspace-types";
export type InboxConversation = { conversation_id: string; subject: string; sender_email: string; recipients: { to: string[]; cc: string[]; bcc: string[] }; snippet: string; direction: "inbound" | "outbound"; unread: number; message_count: number; last_at: string; archived: boolean; state: string };
export type InboxList = { conversations: InboxConversation[]; hasMore: boolean; unread: number };
export type InboxDetail = { messages: (EmailMessage & { direction: "inbound" | "outbound"; read_at: string | null; archived: boolean; received_at: string | null; reply_address: string | null })[]; files: { id: string; message_id: string; name: string; size: number; content_type: string; blocked_reason?: string | null; incoming: boolean }[]; hasOlder: boolean; leads: EmailLead[]; quotes: { id: string; estimate_number: string; project_name: string }[] };
export async function inboxOperation(action: string, values: Record<string,unknown> = {}) {
  const response = await fetch("/api/admin/email/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...values }), signal: AbortSignal.timeout(30_000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Inbox operation failed.");
  return data;
}
