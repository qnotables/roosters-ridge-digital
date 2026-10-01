import { emailProvider } from "@/lib/email-workspace-provider";
import { emailDb, query, type MessageRow } from "@/lib/email-workspace-db";
import { nextDeliveryState } from "@/lib/email-workspace-shared";
import { ingestReceivedEmail } from "@/lib/email-inbox-ingest";
import { canonicalMessageId } from "@/lib/email-inbox-shared";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret)
    return Response.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length") || 0) > 250_000)
    return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 250_000) return new Response(null, { status: 413 });
  const id = request.headers.get("svix-id") || "";
  let event;
  try {
    event = emailProvider().webhooks.verify({
      payload: raw,
      headers: {
        id,
        timestamp: request.headers.get("svix-timestamp") || "",
        signature: request.headers.get("svix-signature") || "",
      },
      webhookSecret: secret,
    });
  } catch {
    return Response.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  }
  if (event.type === "email.received") {
    if (!event.data.email_id || !id) return Response.json({ error: "Invalid received event." }, { status: 400 });
    try {
      const result = await ingestReceivedEmail(event.data.email_id, id);
      return Response.json({ ok: true, result });
    } catch {
      return Response.json({ error: "Incoming message storage unavailable; retry after checking receiving configuration." }, { status: 503 });
    }
  }
  if (
    ![
      "email.sent",
      "email.delivered",
      "email.bounced",
      "email.complained",
      "email.failed",
      "email.suppressed",
      "email.delivery_delayed",
    ].includes(event.type)
  )
    return Response.json({ ok: true });
  const data = event.data as {
    email_id?: string;
    message_id?: string;
    to?: string[];
    bounce?: { type?: string };
  };
  const occurred = new Date(event.created_at);
  if (!data.email_id || !id || Number.isNaN(occurred.getTime()))
    return Response.json({ error: "Invalid event." }, { status: 400 });
  try {
    const result = await emailDb.transaction(async (tx) => {
      await tx.execute(query`SELECT pg_advisory_xact_lock(hashtext('email-inbox-threading'))`);
      const messages = await tx.execute(
        query`SELECT * FROM email_messages WHERE provider_id=${data.email_id} AND user_id='dashboard' FOR UPDATE`,
      );
      const message = messages.rows[0] as MessageRow | undefined;
      if (!message) {
        // A send response may still be persisting. Retry, rather than silently losing the delivery event.
        const pending = await tx.execute(
          query`SELECT id FROM email_messages WHERE user_id='dashboard' AND state='queued' AND provider_id IS NULL LIMIT 1`,
        );
        return pending.rows.length ? "retry" : "unrelated";
      }
      const rfcId = canonicalMessageId(data.message_id);
      if (rfcId) {
        await tx.execute(query`UPDATE email_messages SET rfc_message_id=${rfcId} WHERE id=${message.id}::uuid AND user_id='dashboard'`);
        await tx.execute(query`UPDATE email_messages SET conversation_id=${message.conversation_id}::uuid WHERE user_id='dashboard' AND conversation_id IN (SELECT conversation_id FROM email_messages WHERE user_id='dashboard' AND (in_reply_to=${rfcId} OR reference_ids @> ${JSON.stringify([rfcId])}::jsonb))`);
      }
      const inserted = await tx.execute(
        query`INSERT INTO email_events (id,message_id,type,occurred_at) VALUES (${id},${message.id}::uuid,${event.type},${occurred}) ON CONFLICT (id) DO NOTHING RETURNING id`,
      );
      if (!inserted.rows.length) return "duplicate";
      const state = nextDeliveryState(message.state, event.type);
      const terminal = ["bounced", "complained"].includes(state);
      if (
        terminal ||
        !message.event_at ||
        occurred.getTime() >= new Date(message.event_at).getTime()
      ) {
        await tx.execute(
          query`UPDATE email_messages SET state=${state},event_at=${occurred},last_error=${event.type === "email.suppressed" ? "Resend suppressed this recipient. Do not resend to the suppressed address." : event.type === "email.failed" ? "Provider reported delivery failure. Check Resend before resending." : null},updated_at=now() WHERE id=${message.id}::uuid AND user_id='dashboard'`,
        );
      }
      const hardBounce =
        event.type === "email.bounced" &&
        ["Permanent", "hard"].includes(data.bounce?.type || "");
      if (
        event.type === "email.complained" ||
        event.type === "email.suppressed" ||
        hardBounce
      ) {
        const recipients = [
          ...message.recipients.to,
          ...message.recipients.cc,
          ...message.recipients.bcc,
        ];
        const targets = Array.isArray(data.to)
          ? data.to
              .map((e) => e.toLowerCase())
              .filter((e) => recipients.includes(e))
          : message.recipients.to;
        for (const email of targets)
          await tx.execute(
            query`INSERT INTO email_suppressions (email,reason) VALUES (${email},${event.type}) ON CONFLICT (email) DO NOTHING`,
          );
      }
      return "processed";
    });
    return Response.json(
      { ok: result !== "retry" },
      { status: result === "retry" ? 503 : 200 },
    );
  } catch {
    return Response.json(
      { error: "Event storage unavailable; retry." },
      { status: 503 },
    );
  }
}
