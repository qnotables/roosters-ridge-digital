import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { hasDashboardAccess } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { emailDb, query } from "@/lib/email-workspace-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inbox | RRD Admin", robots: { index: false, follow: false } };

export default async function InboxPage() {
  if (!(await hasDashboardAccess())) redirect("/admin/sign-in");
  let messages: { from_address: string; recipient_addresses: string[]; subject: string; received_at: string }[] = [];
  let unavailable = false;
  try {
    const result = await emailDb.execute(query`SELECT from_address,recipient_addresses,subject,received_at FROM inbound_emails ORDER BY received_at DESC LIMIT 200`);
    messages = result.rows as typeof messages;
  } catch {
    unavailable = true;
  }
  return <AdminShell><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><header><h1 className="flex items-center gap-3 text-3xl font-semibold"><Mail className="size-7 text-primary" />Inbox</h1><p className="mt-2 text-sm text-muted-foreground">Incoming messages received by Resend. Message content remains in Resend.</p></header><div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">{unavailable ? <p className="p-8 text-center text-muted-foreground">The inbox table has not been created yet.</p> : messages.length ? <ul className="divide-y divide-border">{messages.map((message, index) => <li key={`${message.from_address}-${message.received_at}-${index}`} className="p-4"><p className="font-medium">{message.subject || "(No subject)"}</p><p className="mt-1 text-sm text-muted-foreground">From {message.from_address} to {message.recipient_addresses.join(", ")}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(message.received_at).toLocaleString()}</p></li>)}</ul> : <p className="p-8 text-center text-muted-foreground">No incoming emails yet.</p>}</div></main></AdminShell>;
}
