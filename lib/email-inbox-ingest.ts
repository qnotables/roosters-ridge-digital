import "server-only";
import { randomUUID } from "node:crypto";
import { emailDb, query, emailSettings, type MessageRow } from "@/lib/email-workspace-db";
import { emailProvider } from "@/lib/email-workspace-provider";
import { boundedAttachment, canonicalMessageId, headerValue, mailboxAddress, messageIds, safeEmailHtml, INBOUND_FILE_LIMIT, INBOUND_TOTAL_LIMIT } from "@/lib/email-inbox-shared";

export async function ingestReceivedEmail(providerId: string, eventId: string) {
  const settings = await emailSettings();
  if (!settings.incomingAddress) throw new Error("Configure the receiving address before retrying this webhook.");
  const prior = await emailDb.execute(query`SELECT id FROM email_messages WHERE user_id='dashboard' AND direction='inbound' AND provider_id=${providerId}`);
  if (prior.rows.length) return "duplicate";
  const provider = emailProvider();
  const received = await provider.emails.receiving.get(providerId, { html_format: "cid" });
  if (received.error || !received.data) throw new Error("Receiving API unavailable; retry.");
  const email = received.data;
  const deliveredTo = [...email.to, ...(email.cc || []), ...(email.received_for || [])].map(mailboxAddress);
  if (!deliveredTo.includes(settings.incomingAddress.toLowerCase())) return "unrelated";
  const receivedAt = new Date(email.created_at);
  if (Number.isNaN(receivedAt.getTime())) throw new Error("Invalid received time.");
  const rfcId = canonicalMessageId(email.message_id || headerValue(email.headers, "Message-ID"));
  const inReplyTo = canonicalMessageId(headerValue(email.headers, "In-Reply-To"));
  const references = messageIds(headerValue(email.headers, "References"));
  if ((email.html?.length || 0) + (email.text?.length || 0) > 2_000_000) throw new Error("Incoming message exceeds 2 MB body limit.");
  const attachments: { providerId: string; name: string; type: string; size: number; content: string | null; blocked: string | null }[] = [];
  let total = 0;
  for (const metadata of email.attachments || []) {
    const file = { providerId: metadata.id, name: (metadata.filename || "attachment").replace(/[\r\n\x00-\x1f]/g, "_").slice(0, 200), type: metadata.content_type, size: metadata.size, content: null as string | null, blocked: null as string | null };
    if (metadata.size > INBOUND_FILE_LIMIT || total + metadata.size > INBOUND_TOTAL_LIMIT || attachments.length >= 5) {
      file.blocked = "Not downloaded: maximum 3 MB per file, 9 MB total, and five files. Request a smaller attachment.";
    } else {
      await new Promise(resolve => setTimeout(resolve, 600));
      const result = await provider.emails.receiving.attachments.get({ emailId: providerId, id: metadata.id });
      if (result.error || !result.data) throw new Error("Received attachment metadata unavailable; retry.");
      const url = new URL(result.data.download_url);
      if (url.protocol !== "https:") throw new Error("Invalid provider attachment URL.");
      const bytes = await boundedAttachment(await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) }), Math.min(INBOUND_FILE_LIMIT, INBOUND_TOTAL_LIMIT - total));
      if (bytes.length !== metadata.size) throw new Error("Received attachment size mismatch; retry.");
      total += bytes.length;
      file.content = bytes.toString("base64");
    }
    attachments.push(file);
  }
  return emailDb.transaction(async tx => {
    // Serialize graph linking and deduplication so concurrent/reordered webhooks cannot split a thread.
    await tx.execute(query`SELECT pg_advisory_xact_lock(hashtext('email-inbox-threading'))`);
    const existing = await tx.execute(query`SELECT id FROM email_messages WHERE user_id='dashboard' AND ((direction='inbound' AND provider_id=${providerId}) OR (${rfcId}::text IS NOT NULL AND rfc_message_id=${rfcId})) LIMIT 1`);
    if (existing.rows.length) return "duplicate";
    const candidateIds = [...new Set([...references, ...(inReplyTo ? [inReplyTo] : [])])];
    const parents = await tx.execute(query`SELECT id,conversation_id,lead_id,estimate_id,project_name,rfc_message_id FROM email_messages WHERE user_id='dashboard' AND rfc_message_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(candidateIds)}::jsonb))`);
    const parentRows = parents.rows as MessageRow[];
    const parent = [...candidateIds].reverse().map(ref => parentRows.find(p => p.rfc_message_id === ref)).find(Boolean);
    const id = randomUUID();
    const conversation = parent?.conversation_id || randomUUID();
    const recipients = { to: email.to, cc: email.cc || [], bcc: email.bcc || [] };
    await tx.execute(query`INSERT INTO email_messages (id,user_id,direction,conversation_id,provider_id,rfc_message_id,in_reply_to,reference_ids,sender_email,recipients,subject,html,original_html,plain_text,mail_headers,reply_address,received_at,state,retry_safe,lead_id,estimate_id,project_name) VALUES (${id}::uuid,'dashboard','inbound',${conversation}::uuid,${providerId},${rfcId},${inReplyTo},${JSON.stringify(references)}::jsonb,${email.from},${JSON.stringify(recipients)}::jsonb,${email.subject},${safeEmailHtml(email.html || "")},${email.html || ""},${email.text || ""},${JSON.stringify(email.headers || {})}::jsonb,${mailboxAddress(email.reply_to?.[0] || email.from)},${receivedAt},'accepted',false,${parent?.lead_id || null}::uuid,${parent?.estimate_id || null}::uuid,${parent?.project_name || ""})`);
    for (const file of attachments) {
      await tx.execute(query`INSERT INTO email_inbound_attachments (message_id,provider_attachment_id,name,content_type,size,content_base64,blocked_reason) VALUES (${id}::uuid,${file.providerId},${file.name},${file.type},${file.size},${file.content},${file.blocked})`);
    }
    // A child may have arrived before its parent; merge that child's whole conversation, never by subject/sender.
    await tx.execute(query`UPDATE email_messages SET conversation_id=${conversation}::uuid WHERE user_id='dashboard' AND conversation_id IN (SELECT conversation_id FROM email_messages WHERE user_id='dashboard' AND (rfc_message_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(candidateIds)}::jsonb)) OR (${rfcId}::text IS NOT NULL AND (in_reply_to=${rfcId} OR reference_ids @> ${JSON.stringify(rfcId ? [rfcId] : [])}::jsonb))))`);
    await tx.execute(query`UPDATE email_messages SET archived=false WHERE user_id='dashboard' AND conversation_id=${conversation}::uuid`);
    await tx.execute(query`INSERT INTO email_events(id,message_id,type,occurred_at) VALUES (${eventId},${id}::uuid,'email.received',${receivedAt}) ON CONFLICT(id) DO NOTHING`);
    await tx.execute(query`UPDATE email_settings SET last_received_at=now() WHERE id=1 AND incoming_address=${settings.incomingAddress}`);
    return "processed";
  });
}
