import { del } from "@vercel/blob";
import {
  emailDb,
  query,
  requireEmailAccess,
  checkEmailOrigin,
  emailErrorResponse,
  EmailError,
  findMessage,
  findAttachments,
  type AttachmentRow,
} from "@/lib/email-workspace-db";
import {
  storeAttachment,
  attachmentBytes,
} from "@/lib/email-workspace-attachments";
import { UUID, MAX_ATTACHMENT } from "@/lib/email-workspace-shared";
import { emailBlobOptions } from "@/lib/email-blob";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireEmailAccess();
    const search = new URL(request.url).searchParams;
    const id = search.get("id");
    if (id) {
      if (!UUID.test(id)) throw new EmailError("Invalid attachment ID.");
      const result = await emailDb.execute(
        query`SELECT a.* FROM email_attachments a JOIN email_messages m ON m.id=a.message_id WHERE a.id=${id}::uuid AND a.user_id='dashboard' AND m.user_id='dashboard'`,
      );
      const file = result.rows[0] as AttachmentRow | undefined;
      if (!file) throw new EmailError("Attachment not found.", 404);
      const bytes = await attachmentBytes(file);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": file.content_type,
          "Content-Disposition": `${search.get("preview") === "1" && file.content_type === "application/pdf" ? "inline" : "attachment"}; filename="${file.name.replace(/["\\]/g, "_")}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const messageId = search.get("messageId") || "";
    if (!UUID.test(messageId)) throw new EmailError("Invalid message ID.");
    const files = await findAttachments(messageId);
    return Response.json(
      { files: files.map(({ pathname, ...f }) => f) },
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
    if (
      Number(request.headers.get("content-length") || 0) >
      MAX_ATTACHMENT + 50_000
    )
      throw new EmailError("Attachment exceeds 3 MB.", 413);
    const form = await request.formData();
    const id = String(form.get("messageId") || "");
    if (!UUID.test(id))
      throw new EmailError("Save the draft before uploading.");
    const message = await findMessage(id);
    if (
      !message ||
      !["draft", "failed"].includes(message.state) ||
      !message.retry_safe
    )
      throw new EmailError("Message is not editable.", 409);
    const file = form.get("file");
    if (!(file instanceof File) || file.size > MAX_ATTACHMENT)
      throw new EmailError("Invalid file or attachment exceeds 3 MB.");
    return Response.json(
      await storeAttachment(
        id,
        file.name,
        file.type,
        Buffer.from(await file.arrayBuffer()),
      ),
    );
  } catch (error) {
    return emailErrorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkEmailOrigin(request);
    await requireEmailAccess();
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!UUID.test(id)) throw new EmailError("Invalid attachment ID.");
    const pathname = await emailDb.transaction(async (tx) => {
      const found = await tx.execute(
        query`SELECT a.* FROM email_attachments a JOIN email_messages m ON m.id=a.message_id WHERE a.id=${id}::uuid AND a.user_id='dashboard' AND m.user_id='dashboard' AND m.state IN ('draft','failed') AND m.retry_safe=true FOR UPDATE OF m`,
      );
      const file = found.rows[0] as AttachmentRow | undefined;
      if (!file) throw new EmailError("Attachment is not editable.", 409);
      await tx.execute(
        query`DELETE FROM email_attachments WHERE id=${id}::uuid AND user_id='dashboard'`,
      );
      return file.pathname;
    });
    await del(pathname, emailBlobOptions());
    return Response.json({ ok: true });
  } catch (error) {
    return emailErrorResponse(error);
  }
}
