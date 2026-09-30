"use client";
import Link from "next/link";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { emailFetcher, type EmailMessage } from "@/lib/email-workspace-types";

export function LeadEmailHistory({ leadId }: { leadId: string }) {
  const { data, error, isLoading } = useSWR<{
    messages: EmailMessage[];
    events: { message_id: string; type: string; occurred_at: string }[];
  }>(`/api/admin/email?leadId=${leadId}`, emailFetcher);
  return (
    <section
      className="mt-5 flex flex-col gap-3 border-t border-border pt-5"
      aria-label="Customer email activity"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Customer email history</h3>
        <Link
          className="text-sm text-primary underline underline-offset-4"
          href={`/admin/email?leadId=${leadId}`}
        >
          Compose email
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Delivery statuses below come from Resend, not internal staff notes.
        Replies arrive in the monitored business mailbox.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading email history…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          Email history unavailable.
        </p>
      ) : data?.messages.filter((m) => m.state !== "draft").length ? (
        <ul className="flex flex-col gap-3">
          {data.messages
            .filter((m) => m.state !== "draft")
            .map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/admin/email?draftId=${m.id}`}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    {m.subject}
                  </Link>
                  <Badge
                    variant={
                      ["failed", "bounced", "complained"].includes(m.state)
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {m.state}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.recipients.to.join(", ")} · Staff:{" "}
                  {m.sender_email || "Not sent"} ·{" "}
                  {new Date(m.accepted_at || m.created_at).toLocaleString()}
                </p>
                {data.events
                  .filter((e) => e.message_id === m.id)
                  .map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      Resend: {e.type.replace("email.", "")} ·{" "}
                      {new Date(e.occurred_at).toLocaleString()}
                    </p>
                  ))}
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No sent emails associated with this lead.
        </p>
      )}
    </section>
  );
}
