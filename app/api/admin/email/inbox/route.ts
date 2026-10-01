import { emailDb, query, requireEmailAccess, checkEmailOrigin, emailErrorResponse, EmailError } from "@/lib/email-workspace-db";
import { UUID } from "@/lib/email-workspace-shared";
import { safeEmailHtml } from "@/lib/email-inbox-shared";
import { createReplyDraft, setConversationState, saveReceivingAddress, associateConversation } from "@/lib/email-inbox-service";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    await requireEmailAccess();
    const params = new URL(request.url).searchParams;
    const conversationId = params.get("conversationId");
    if (conversationId) {
      if (!UUID.test(conversationId)) throw new EmailError("Invalid conversation ID.");
      const found = await emailDb.execute(query`SELECT id,conversation_id,direction,sender_email,reply_address,recipients,subject,html,plain_text,rfc_message_id,in_reply_to,reference_ids,reply_to_message_id,lead_id,estimate_id,project_name,state,received_at,accepted_at,created_at,read_at,archived,last_error FROM email_messages WHERE user_id='dashboard' AND conversation_id=${conversationId}::uuid AND (direction='inbound' OR state<>'draft') ORDER BY COALESCE(received_at,accepted_at,created_at) DESC LIMIT 101`);
      if (!found.rows.length) throw new EmailError("Conversation not found.", 404);
      const files = await emailDb.execute(query`SELECT id,message_id,name,size,content_type,blocked_reason FROM email_inbound_attachments WHERE user_id='dashboard' AND message_id IN (SELECT id FROM email_messages WHERE user_id='dashboard' AND conversation_id=${conversationId}::uuid)`);
      const sentFiles = await emailDb.execute(query`SELECT id,message_id,name,size,content_type FROM email_attachments WHERE user_id='dashboard' AND message_id IN (SELECT id FROM email_messages WHERE user_id='dashboard' AND conversation_id=${conversationId}::uuid)`);
      const leads = await emailDb.execute(query`SELECT id,first_name,last_name,business_name,email FROM leads ORDER BY created_at DESC LIMIT 500`);
      const quotes = await emailDb.execute(query`SELECT id,estimate_number,project_name FROM pricing_estimates ORDER BY created_at DESC LIMIT 500`);
      return Response.json({ messages: found.rows.slice(0,100).reverse().map(m => ({ ...m, html: safeEmailHtml(String(m.html || "")) })), hasOlder: found.rows.length > 100, files: [...files.rows.map(f => ({ ...f, incoming: true })), ...sentFiles.rows.map(f => ({ ...f, incoming: false }))], leads: leads.rows, quotes: quotes.rows }, { headers: privateHeaders });
    }
    const folder = params.get("folder") || "inbox";
    if (!["inbox", "sent", "archive"].includes(folder)) throw new EmailError("Invalid folder.");
    const search = (params.get("search") || "").trim().slice(0,200);
    const page = Math.min(10_000, Math.max(0, Number(params.get("page") || 0) || 0));
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await emailDb.execute(query`WITH conversations AS (
      SELECT conversation_id, bool_or(direction='inbound') AS incoming, bool_or(direction='outbound' AND state<>'draft') AS sent, bool_and(archived) AS archived, count(*) FILTER(WHERE direction='inbound' AND read_at IS NULL)::int AS unread, max(COALESCE(received_at,accepted_at,created_at)) AS last_at, count(*)::int AS message_count
      FROM email_messages WHERE user_id='dashboard' AND (direction='inbound' OR state<>'draft') GROUP BY conversation_id
    ) SELECT c.*, latest.subject,latest.sender_email,latest.recipients,left(latest.plain_text,160) AS snippet,latest.direction,latest.state
      FROM conversations c CROSS JOIN LATERAL (SELECT subject,sender_email,recipients,plain_text,direction,state FROM email_messages WHERE user_id='dashboard' AND conversation_id=c.conversation_id AND (direction='inbound' OR state<>'draft') ORDER BY COALESCE(received_at,accepted_at,created_at) DESC LIMIT 1) latest
      WHERE ((${folder}='inbox' AND c.incoming AND NOT c.archived) OR (${folder}='sent' AND c.sent AND NOT c.archived) OR (${folder}='archive' AND c.archived))
      AND (${search}='' OR EXISTS(SELECT 1 FROM email_messages m WHERE m.user_id='dashboard' AND m.conversation_id=c.conversation_id AND (m.subject ILIKE ${pattern} OR m.plain_text ILIKE ${pattern} OR m.sender_email ILIKE ${pattern} OR m.recipients::text ILIKE ${pattern})))
      ORDER BY c.last_at DESC LIMIT 51 OFFSET ${Math.floor(page)*50}`);
    const counts = await emailDb.execute(query`SELECT count(DISTINCT conversation_id) FILTER(WHERE direction='inbound' AND read_at IS NULL AND NOT archived)::int AS unread FROM email_messages WHERE user_id='dashboard'`);
    return Response.json({ conversations: rows.rows.slice(0,50), hasMore: rows.rows.length > 50, unread: counts.rows[0]?.unread || 0 }, { headers: privateHeaders });
  } catch (error) { return emailErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    checkEmailOrigin(request);
    await requireEmailAccess();
    if (Number(request.headers.get("content-length") || 0) > 10_000) throw new EmailError("Request too large.", 413);
    const raw = await request.text();
    if (raw.length > 10_000) throw new EmailError("Request too large.", 413);
    const body = JSON.parse(raw);
    let result;
    if (body.action === "reply") result = await createReplyDraft(body.messageId, body.draftId);
    else if (["read","unread","archive","restore"].includes(body.action)) result = await setConversationState(body.conversationId, body.action);
    else if (body.action === "receiving-settings") result = await saveReceivingAddress(body.address);
    else if (body.action === "associate") result = await associateConversation(body.conversationId, body.leadId || null, body.estimateId || null);
    else throw new EmailError("Unknown inbox operation.");
    return Response.json(result, { headers: privateHeaders });
  } catch (error) { return emailErrorResponse(error); }
}
