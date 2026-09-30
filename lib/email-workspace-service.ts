import "server-only";
import { randomUUID } from "node:crypto";
import {
  emailDb,
  query,
  requireEmailAccess,
  requireStaff,
  EmailError,
  findMessage,
  findAttachments,
  type MessageRow,
  type FrozenPayload,
} from "@/lib/email-workspace-db";
import {
  validateDraft,
  UUID,
  MAX_FILES,
  MAX_TOTAL,
  defaultTemplates,
  escapeHtml,
  type DraftInput,
} from "@/lib/email-workspace-shared";
import { emailProvider, emailReadiness } from "@/lib/email-workspace-provider";
import {
  attachmentBytes,
  storeAttachment,
} from "@/lib/email-workspace-attachments";
import { getEstimateById } from "@/lib/pricing";
import {
  customerEstimateFields,
  customerEstimatePdf,
} from "@/lib/email-estimate-pdf";

export async function saveEmailDraft(input: DraftInput) {
  await requireEmailAccess();
  const valid = validateDraft(input);
  const id = input.id || randomUUID();
  await emailDb.transaction(async (tx) => {
    if (valid.leadId) {
      const lead = await tx.execute(
        query`SELECT id FROM leads WHERE id=${valid.leadId}::uuid`,
      );
      if (!lead.rows[0]) throw new EmailError("Lead no longer exists.");
    }
    const existing = await tx.execute(
      query`SELECT state,retry_safe FROM email_messages WHERE id=${id}::uuid AND user_id='dashboard' FOR UPDATE`,
    );
    if (
      existing.rows[0] &&
      (!["draft", "failed"].includes(String(existing.rows[0].state)) ||
        !existing.rows[0].retry_safe)
    )
      throw new EmailError(
        "This message is locked after a send attempt. Retry the unchanged message or create a new draft.",
        409,
      );
    await tx.execute(
      query`INSERT INTO email_messages (id,recipients,subject,html,plain_text,lead_id,project_name) VALUES (${id}::uuid,${JSON.stringify(valid.recipients)}::jsonb,${valid.subject},${valid.html},${valid.plainText},${valid.leadId}::uuid,${valid.projectName}) ON CONFLICT (id) DO UPDATE SET recipients=EXCLUDED.recipients,subject=EXCLUDED.subject,html=EXCLUDED.html,plain_text=EXCLUDED.plain_text,lead_id=EXCLUDED.lead_id,project_name=EXCLUDED.project_name,state='draft',attempt_id=NULL,attempt_at=NULL,frozen_payload=NULL,last_error=NULL,updated_at=now() WHERE email_messages.user_id='dashboard' AND email_messages.state IN ('draft','failed') AND email_messages.retry_safe=true`,
    );
  });
  return id;
}
export async function sendEmailDraft(id: string) {
  if (!UUID.test(id)) throw new EmailError("Invalid message ID.");
  const staff = await requireStaff();
  const readiness = await emailReadiness();
  if (!readiness.ready)
    throw new EmailError(
      `Sending disabled: ${readiness.missing.join("; ")}.`,
      409,
    );
  const prepared = await emailDb.transaction(async (tx) => {
    await tx.execute(
      query`SELECT pg_advisory_xact_lock(hashtext('email-send-workspace'))`,
    );
    const found = await tx.execute(
      query`SELECT * FROM email_messages WHERE id=${id}::uuid AND user_id='dashboard' FOR UPDATE`,
    );
    const row = found.rows[0] as MessageRow | undefined;
    if (!row) throw new EmailError("Message not found.", 404);
    if (
      row.provider_id ||
      ["accepted", "delivered", "bounced", "complained"].includes(row.state)
    )
      return { complete: true, row };
    if (row.attempt_id && row.sender_id !== staff.id)
      throw new EmailError(
        "Only the original sending staff member can retry this attempt.",
        403,
      );
    if (
      row.attempt_at &&
      Date.now() - new Date(row.attempt_at).getTime() > 23 * 60 * 60 * 1000
    )
      throw new EmailError(
        "This attempt is outside the safe idempotency window. Reconcile its status in Resend before composing another message.",
        409,
      );
    let payload = row.frozen_payload;
    if (!payload) {
      const valid = validateDraft(
        {
          recipients: row.recipients,
          subject: row.subject,
          html: row.html,
          plainText: row.plain_text,
        },
        true,
      );
      const rate = await tx.execute(
        query`SELECT count(*) FILTER (WHERE attempt_at > now()-interval '1 minute')::int AS minute, count(*) FILTER (WHERE attempt_at > now()-interval '1 day')::int AS day FROM email_messages WHERE user_id='dashboard' AND sender_id=${staff.id}`,
      );
      if (Number(rate.rows[0].minute) >= 5 || Number(rate.rows[0].day) >= 50)
        throw new EmailError(
          "Staff sending limit reached: 5 per minute, 50 per day.",
          429,
        );
      const files = await tx.execute(
        query`SELECT * FROM email_attachments WHERE message_id=${id}::uuid AND user_id='dashboard' ORDER BY created_at`,
      );
      const attachments = files.rows as FrozenPayload["files"];
      if (
        attachments.length > MAX_FILES ||
        attachments.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL
      )
        throw new EmailError("Attachment limits exceeded.");
      if (
        row.estimate_id &&
        !attachments.some((f) => f.estimate_id === row.estimate_id)
      )
        throw new EmailError(
          "The customer-facing estimate PDF must be attached before sending.",
        );
      payload = {
        from: readiness.sender,
        to: valid.recipients.to,
        cc: valid.recipients.cc,
        bcc: valid.recipients.bcc,
        subject: valid.subject,
        html: valid.html,
        text: valid.plainText,
        replyTo: readiness.replyTo,
        files: attachments,
      };
    }
    const addresses = [...payload.to, ...payload.cc, ...payload.bcc];
    const suppressed = await tx.execute(
      query`SELECT email FROM email_suppressions WHERE email=ANY(${addresses}::text[])`,
    );
    if (suppressed.rows.length)
      throw new EmailError(
        "A recipient is suppressed after a hard bounce or spam complaint. Remove that recipient; do not retry delivery.",
      );
    const requestRate = await tx.execute(
      query`SELECT count(*)::int AS count FROM email_send_requests WHERE staff_id=${staff.id} AND created_at > now()-interval '1 minute'`,
    );
    if (Number(requestRate.rows[0].count) >= 5)
      throw new EmailError(
        "Staff send-request limit reached. Wait one minute before retrying.",
        429,
      );
    await tx.execute(
      query`INSERT INTO email_send_requests (id,staff_id,message_id) VALUES (${randomUUID()}::uuid,${staff.id},${id}::uuid)`,
    );
    const attemptId = row.attempt_id || randomUUID();
    // Freeze exactly one provider payload so retries cannot change content under the same idempotency key.
    await tx.execute(
      query`UPDATE email_messages SET state='queued',sender_id=${staff.id},sender_email=${staff.email},attempt_id=${attemptId}::uuid,attempt_at=COALESCE(attempt_at,now()),frozen_payload=${JSON.stringify(payload)}::jsonb,retry_safe=false,updated_at=now() WHERE id=${id}::uuid AND user_id='dashboard'`,
    );
    return { complete: false, row, payload, attemptId };
  });
  if (prepared.complete) return { state: prepared.row.state, id };
  const payload = prepared.payload!;
  const files = await Promise.all(
    payload.files.map(async (f) => ({
      filename: f.name,
      content: await attachmentBytes(f),
      contentType: f.content_type,
    })),
  );
  try {
    const { data, error } = await emailProvider().emails.send(
      {
        from: payload.from,
        to: payload.to,
        ...(payload.cc.length ? { cc: payload.cc } : {}),
        ...(payload.bcc.length ? { bcc: payload.bcc } : {}),
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
        attachments: files,
        tags: [{ name: "workspace_message", value: id }],
      },
      { idempotencyKey: `rrd-email/${prepared.attemptId}` },
    );
    if (error) {
      const definitive = Boolean(
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500 &&
        ![408, 409, 429].includes(error.statusCode),
      );
      await emailDb.execute(
        query`UPDATE email_messages SET state=${definitive ? "failed" : "queued"},retry_safe=${definitive},last_error=${`Resend ${error.name}: ${error.message}`.slice(0, 600)},updated_at=now() WHERE id=${id}::uuid AND user_id='dashboard' AND provider_id IS NULL`,
      );
      throw new EmailError(
        definitive
          ? "Resend rejected the email. Your draft is preserved; review the failure details before retrying."
          : "Acceptance is uncertain. Retry this unchanged attempt within 23 hours; do not create a duplicate message.",
        409,
      );
    }
    await emailDb.execute(
      query`UPDATE email_messages SET provider_id=${data.id},state=CASE WHEN state IN ('queued','draft','failed') THEN 'accepted' ELSE state END,accepted_at=COALESCE(accepted_at,now()),last_error=NULL,updated_at=now() WHERE id=${id}::uuid AND user_id='dashboard'`,
    );
    return { id, state: "accepted" };
  } catch (error) {
    if (error instanceof EmailError) throw error;
    await emailDb.execute(
      query`UPDATE email_messages SET last_error='Acceptance uncertain. Retry the unchanged attempt within 23 hours.',updated_at=now() WHERE id=${id}::uuid AND user_id='dashboard' AND provider_id IS NULL`,
    );
    throw new EmailError(
      "Network or persistence failure: acceptance is uncertain. Retry this unchanged attempt within 23 hours.",
      409,
    );
  }
}
export async function createEstimateDraft(estimateId: string) {
  await requireEmailAccess();
  if (!UUID.test(estimateId)) throw new EmailError("Invalid estimate ID.");
  const estimate = await getEstimateById(estimateId);
  if (!estimate) throw new EmailError("Estimate not found.", 404);
  const readiness = await emailReadiness();
  const subject = `Your estimate ${estimate.estimateNumber} — ${estimate.projectName}`;
  const html = `<p>Hello ${escapeHtml(estimate.clientName || "{{customer_name}}")},</p><p>Attached is estimate ${escapeHtml(estimate.estimateNumber)} for ${escapeHtml(estimate.projectName || "{{project_name}}")}. Please review the scope and investment and let me know if you would like to discuss anything.</p>${readiness.signature}`;
  const relatedLead = estimate.email
    ? await emailDb.execute(
        query`SELECT id FROM leads WHERE lower(email)=lower(${estimate.email}) ORDER BY created_at DESC LIMIT 1`,
      )
    : { rows: [] };
  const leadId = relatedLead.rows[0]?.id
    ? String(relatedLead.rows[0].id)
    : null;
  const id = await saveEmailDraft({
    recipients: { to: estimate.email ? [estimate.email] : [], cc: [], bcc: [] },
    subject,
    html,
    projectName: estimate.projectName,
    leadId,
  });
  await emailDb.execute(
    query`UPDATE email_messages SET estimate_id=${estimateId}::uuid,estimate_snapshot=${JSON.stringify({ lines: customerEstimateFields(estimate), estimateNumber: estimate.estimateNumber, contact: readiness.replyTo })}::jsonb WHERE id=${id}::uuid AND user_id='dashboard'`,
  );
  try {
    await attachEstimate(id);
    return { id };
  } catch (error) {
    return {
      id,
      warning:
        error instanceof Error
          ? error.message
          : "Estimate PDF is not attached. Sending is disabled until attachment setup is complete.",
    };
  }
}
export async function attachEstimate(id: string) {
  await requireEmailAccess();
  const message = await findMessage(id);
  if (!message?.estimate_id) throw new EmailError("No linked estimate.");
  const files = await findAttachments(id);
  if (files.some((f) => f.estimate_id === message.estimate_id)) return;
  const snapshot = message.estimate_snapshot;
  if (!snapshot)
    throw new EmailError(
      "The saved customer estimate snapshot is missing. Create a new estimate email draft.",
    );
  const bytes = await customerEstimatePdf(snapshot.lines, snapshot.contact);
  await storeAttachment(
    id,
    `${snapshot.estimateNumber.replace(/[^a-z0-9-]/gi, "_")}.pdf`,
    "application/pdf",
    bytes,
    message.estimate_id,
  );
}
export async function emailTemplates() {
  const result = await emailDb.execute(
    query`SELECT id,name,subject,html FROM email_templates WHERE user_id='dashboard' ORDER BY name`,
  );
  return defaultTemplates.map(
    (t) => (result.rows.find((r) => r.id === t.id) as typeof t) || t,
  );
}
