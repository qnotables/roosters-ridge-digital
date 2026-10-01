import { emailDb, query, requireEmailAccess, emailErrorResponse, EmailError } from "@/lib/email-workspace-db";
import { UUID } from "@/lib/email-workspace-shared";
import { INBOUND_FILE_LIMIT } from "@/lib/email-inbox-shared";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireEmailAccess();
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!UUID.test(id)) throw new EmailError("Invalid attachment ID.");
    const result = await emailDb.execute(query`SELECT a.name,a.size,a.content_base64,a.blocked_reason FROM email_inbound_attachments a JOIN email_messages m ON m.id=a.message_id AND m.user_id=a.user_id WHERE a.id=${id}::uuid AND a.user_id='dashboard' AND m.direction='inbound'`);
    const file = result.rows[0];
    if (!file) throw new EmailError("Attachment not found.", 404);
    if (!file.content_base64 || file.blocked_reason) throw new EmailError(String(file.blocked_reason || "Attachment unavailable."), 409);
    const bytes = Buffer.from(String(file.content_base64), "base64");
    if (bytes.length !== Number(file.size) || bytes.length > INBOUND_FILE_LIMIT) throw new EmailError("Attachment size mismatch.", 409);
    const name = String(file.name).replace(/[\r\n"\\\x00-\x1f]/g,"_");
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g,"_")}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { return emailErrorResponse(error); }
}
