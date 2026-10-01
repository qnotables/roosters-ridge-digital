import "server-only";
import { randomUUID } from "node:crypto";
import { emailDb, query, requireEmailAccess, findMessage, emailSettings, EmailError } from "@/lib/email-workspace-db";
import { UUID, EMAIL, validateDraft } from "@/lib/email-workspace-shared";
import { canonicalMessageId, mailboxAddress, replySubject } from "@/lib/email-inbox-shared";
import { emailProvider } from "@/lib/email-workspace-provider";

export async function createReplyDraft(parentId: string, draftId: string = randomUUID()) {
  await requireEmailAccess();
  if (!UUID.test(parentId) || !UUID.test(draftId)) throw new EmailError("Invalid message ID.");
  const parent = await findMessage(parentId);
  if (!parent || (parent.direction !== "inbound" && !parent.provider_id)) throw new EmailError("Choose a received or provider-accepted message.", 409);
  if (!canonicalMessageId(parent.rfc_message_id)) throw new EmailError("The original Message-ID is unavailable. Wait for the sending webhook; historical messages without threading headers cannot be replied to safely.", 409);
  const recipient = parent.direction === "inbound" ? mailboxAddress(parent.reply_address || parent.sender_email || "") : mailboxAddress(parent.recipients.to[0] || "");
  if (!recipient) throw new EmailError("Original sender has no valid reply address.");
  const draft = validateDraft({ recipients: { to: [recipient], cc: [], bcc: [] }, subject: replySubject(parent.subject), html: `<p></p>` });
  await emailDb.transaction(async tx => {
    const existing = await tx.execute(query`SELECT reply_to_message_id FROM email_messages WHERE id=${draftId}::uuid AND user_id='dashboard'`);
    if (existing.rows.length) {
      if (existing.rows[0].reply_to_message_id !== parentId) throw new EmailError("Draft ID is already used.", 409);
      return;
    }
    await tx.execute(query`INSERT INTO email_messages (id,recipients,subject,html,plain_text,conversation_id,in_reply_to,reference_ids,reply_to_message_id,lead_id,estimate_id,project_name) VALUES (${draftId}::uuid,${JSON.stringify(draft.recipients)}::jsonb,${draft.subject},${draft.html},${draft.plainText},${parent.conversation_id}::uuid,${parent.rfc_message_id},${JSON.stringify([...new Set([...(parent.reference_ids || []), parent.rfc_message_id])])}::jsonb,${parentId}::uuid,${parent.lead_id}::uuid,${parent.estimate_id}::uuid,${parent.project_name})`);
  });
  return { id: draftId };
}
export async function setConversationState(id: string, action: "read" | "unread" | "archive" | "restore") {
  await requireEmailAccess();
  if (!UUID.test(id)) throw new EmailError("Invalid conversation ID.");
  const found = await emailDb.execute(query`SELECT id FROM email_messages WHERE user_id='dashboard' AND conversation_id=${id}::uuid LIMIT 1`);
  if (!found.rows.length) throw new EmailError("Conversation not found.", 404);
  if (action === "read" || action === "unread") await emailDb.execute(query`UPDATE email_messages SET read_at=${action === "read" ? new Date() : null} WHERE user_id='dashboard' AND direction='inbound' AND conversation_id=${id}::uuid`);
  else await emailDb.execute(query`UPDATE email_messages SET archived=${action === "archive"} WHERE user_id='dashboard' AND conversation_id=${id}::uuid`);
  return { ok: true };
}
export async function saveReceivingAddress(value: unknown) {
  await requireEmailAccess();
  const address = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (address && (!EMAIL.test(address) || address.length > 254)) throw new EmailError("Enter a valid receiving address.");
  if (address && !address.split("@")[1].endsWith(".resend.app")) {
    const provider = emailProvider();
    const domains = await provider.domains.list();
    if (domains.error || !domains.data) throw new EmailError("Unable to verify receiving-domain permissions. No settings were changed.", 409);
    const domain = domains.data.data.find(d => d.name.toLowerCase() === address.split("@")[1]);
    if (!domain) throw new EmailError("This domain is not configured for receiving. Use a Resend-managed .resend.app address, or review subdomain DNS separately. Do not change the business mailbox MX.", 409);
    const verified = await provider.domains.get(domain.id);
    if (verified.error || verified.data?.status !== "verified" || verified.data.capabilities.receiving !== "enabled" || !verified.data.records.some(r => r.record === "Receiving" && r.status === "verified")) throw new EmailError("Receiving is not verified for this domain. No DNS or settings were changed.", 409);
  }
  const settings = await emailSettings();
  await emailDb.execute(query`INSERT INTO email_settings(id,incoming_address) VALUES(1,${address}) ON CONFLICT(id) DO UPDATE SET incoming_address=EXCLUDED.incoming_address,last_received_at=CASE WHEN email_settings.incoming_address=EXCLUDED.incoming_address THEN email_settings.last_received_at ELSE NULL END,updated_at=now()`);
  return { ok: true, changed: settings.incomingAddress !== address };
}
export async function associateConversation(id: string, leadId: string | null, estimateId: string | null) {
  await requireEmailAccess();
  if (!UUID.test(id) || (leadId && !UUID.test(leadId)) || (estimateId && !UUID.test(estimateId))) throw new EmailError("Invalid association.");
  await emailDb.transaction(async tx => {
    if (leadId) {
      const found = await tx.execute(query`SELECT id FROM leads WHERE id=${leadId}::uuid`);
      if (!found.rows.length) throw new EmailError("Client record not found.");
    }
    if (estimateId) {
      const found = await tx.execute(query`SELECT id FROM pricing_estimates WHERE id=${estimateId}::uuid`);
      if (!found.rows.length) throw new EmailError("Quote record not found.");
    }
    // Associations are an explicit staff decision; leave frozen send/quote snapshots untouched.
    const updated = await tx.execute(query`UPDATE email_messages SET lead_id=${leadId}::uuid,estimate_id=${estimateId}::uuid WHERE user_id='dashboard' AND conversation_id=${id}::uuid AND direction='inbound' RETURNING id`);
    if (!updated.rows.length) throw new EmailError("No incoming message in this conversation.", 404);
  });
  return { ok: true };
}
