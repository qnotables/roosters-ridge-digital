import { emailProvider } from "@/lib/email-workspace-provider";
import { emailDb, query, emailSettings, type MessageRow } from "@/lib/email-workspace-db";
import { nextDeliveryState } from "@/lib/email-workspace-shared";

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
    const data = event.data as { email_id?: string; from?: string; to?: string[]; subject?: string };
    const receivedAt = new Date(event.created_at);
    if (!id || !data.email_id || !data.from || !Array.isArray(data.to) || Number.isNaN(receivedAt.getTime()))
      return Response.json({ error: "Invalid inbound email event." }, { status: 400 });
    const safeFrom = data.from.replace(/[\r\n]+/g, " ").slice(0, 320);
    const safeSubject = (data.subject || "").replace(/[\r\n]+/g, " ").slice(0, 500);
    if (!safeFrom) return Response.json({ error: "Invalid inbound email event." }, { status: 400 });
    try {
      const stored = await emailDb.execute(
        query`INSERT INTO inbound_emails (event_id,provider_email_id,from_address,recipient_addresses,subject,received_at) VALUES (${id},${data.email_id},${safeFrom},${JSON.stringify(data.to)}::jsonb,${safeSubject},${receivedAt}) ON CONFLICT DO NOTHING RETURNING event_id`,
      );
      if (!stored.rows.length) return Response.json({ ok: true });
      const [settings] = await Promise.all([emailSettings()]);
      const subject = `New email from ${safeFrom}: ${safeSubject || "(No subject)"}`;
      const text = `New email received\n\nFrom: ${safeFrom}\nTo: ${data.to.join(", ")}\nSubject: ${safeSubject || "(No subject)"}\nReceived: ${receivedAt.toISOString()}`;
      const notifications: Promise<unknown>[] = [];
      if (process.env.INBOUND_ALERT_EMAIL && settings.sender)
        notifications.push(emailProvider().emails.send({ from: settings.sender, to: process.env.INBOUND_ALERT_EMAIL, subject, text }));
      const slackWebhook = process.env.SLACK_INBOUND_EMAIL_WEBHOOK_URL;
      if (slackWebhook && new URL(slackWebhook).protocol === "https:" && new URL(slackWebhook).hostname === "hooks.slack.com")
        notifications.push(fetch(slackWebhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `${subject}\n${text}`, mrkdwn: false }) }));
      await Promise.allSettled(notifications);
      return Response.json({ ok: true });
    } catch {
      return Response.json({ error: "Inbound email storage unavailable; retry." }, { status: 503 });
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
    to?: string[];
    bounce?: { type?: string };
  };
  const occurred = new Date(event.created_at);
  if (!data.email_id || !id || Number.isNaN(occurred.getTime()))
    return Response.json({ error: "Invalid event." }, { status: 400 });
  try {
    const result = await emailDb.transaction(async (tx) => {
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
