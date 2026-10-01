import {
  emailDb,
  query,
  requireEmailAccess,
  checkEmailOrigin,
  emailErrorResponse,
  emailSettings,
  EmailError,
} from "@/lib/email-workspace-db";
import { emailReadiness } from "@/lib/email-workspace-provider";
import {
  saveEmailDraft,
  sendEmailDraft,
  reconcileEmailDraft,
  createEstimateDraft,
  emailTemplates,
  attachEstimate,
} from "@/lib/email-workspace-service";
import { EMAIL, cleanHtml, UUID } from "@/lib/email-workspace-shared";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireEmailAccess();
    const leadId = new URL(request.url).searchParams.get("leadId");
    if (leadId && !UUID.test(leadId)) throw new EmailError("Invalid lead ID.");
    const messages = await emailDb.execute(
      query`SELECT id,recipients,subject,html,plain_text,lead_id,estimate_id,project_name,state,sender_email,provider_id,last_error,retry_safe,attempt_at,accepted_at,created_at,conversation_id,direction,rfc_message_id,reply_to_message_id FROM email_messages WHERE user_id='dashboard' AND direction='outbound' AND (${leadId}::uuid IS NULL OR lead_id=${leadId}::uuid) ORDER BY created_at DESC LIMIT 200`,
    );
    if (leadId) {
      const events = await emailDb.execute(
        query`SELECT e.message_id,e.type,e.occurred_at FROM email_events e JOIN email_messages m ON m.id=e.message_id WHERE m.user_id='dashboard' AND m.lead_id=${leadId}::uuid ORDER BY e.occurred_at DESC LIMIT 200`,
      );
      return Response.json(
        { messages: messages.rows, events: events.rows },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const leads = await emailDb.execute(
      query`SELECT id,first_name,last_name,business_name,email FROM leads ORDER BY created_at DESC LIMIT 500`,
    );
    const [setup, templates] = await Promise.all([
      emailReadiness(),
      emailTemplates(),
    ]);
    return Response.json(
      { messages: messages.rows, leads: leads.rows, setup, staff: null, staffAccount: null, templates },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return emailErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    checkEmailOrigin(request);
    await requireEmailAccess();
    if (Number(request.headers.get("content-length") || 0) > 250_000)
      throw new EmailError("Request too large.", 413);
    const raw = await request.text();
    if (raw.length > 250_000) throw new EmailError("Request too large.", 413);
    const body = JSON.parse(raw);
    if (body.action === "draft")
      return Response.json({ id: await saveEmailDraft(body.draft) });
    if (body.action === "send")
      return Response.json(await sendEmailDraft(body.id));
    if (body.action === "reconcile")
      return Response.json(await reconcileEmailDraft(body.id));
    if (body.action === "estimate")
      return Response.json(await createEstimateDraft(body.estimateId));
    if (body.action === "attach-estimate") {
      if (!UUID.test(body.id)) throw new EmailError("Invalid ID.");
      await attachEstimate(body.id);
      return Response.json({ ok: true });
    }
    if (body.action === "settings") {
      const sender = String(body.sender || "")
        .trim()
        .toLowerCase();
      if (!EMAIL.test(sender))
        throw new EmailError("Enter a valid sender address.");
      await emailDb.execute(
        query`INSERT INTO email_settings (id,sender,staff_emails) VALUES (1,${sender},'[]'::jsonb) ON CONFLICT (id) DO UPDATE SET sender=EXCLUDED.sender,updated_at=now()`,
      );
      return Response.json(await emailSettings());
    }
    if (body.action === "template") {
      const templates = await emailTemplates();
      const t = templates.find((t) => t.id === body.id);
      if (
        !t ||
        typeof body.subject !== "string" ||
        typeof body.html !== "string" ||
        body.subject.length > 200 ||
        body.html.length > 100_000
      )
        throw new EmailError("Invalid template.");
      await emailDb.execute(
        query`INSERT INTO email_templates (id,name,subject,html) VALUES (${t.id},${t.name},${body.subject},${cleanHtml(body.html)}) ON CONFLICT (id) DO UPDATE SET subject=EXCLUDED.subject,html=EXCLUDED.html,updated_at=now() WHERE email_templates.user_id='dashboard'`,
      );
      return Response.json({ ok: true });
    }
    throw new EmailError("Unknown email operation.");
  } catch (error) {
    return emailErrorResponse(error);
  }
}
