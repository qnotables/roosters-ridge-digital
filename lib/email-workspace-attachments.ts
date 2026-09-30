import "server-only";
import { randomUUID } from "node:crypto";
import { put, get, del } from "@vercel/blob";
import {
  emailDb,
  query,
  EmailError,
  type AttachmentRow,
} from "@/lib/email-workspace-db";
import {
  MAX_ATTACHMENT,
  MAX_FILES,
  MAX_TOTAL,
} from "@/lib/email-workspace-shared";
import { emailBlobOptions } from "@/lib/email-blob";

export function validateAttachment(
  name: string,
  contentType: string,
  bytes: Buffer,
) {
  if (!bytes.length || bytes.length > MAX_ATTACHMENT)
    throw new EmailError("Each attachment must be between 1 byte and 3 MB.");
  const extension = name.split(".").pop()?.toLowerCase();
  const valid =
    (extension === "pdf" &&
      contentType === "application/pdf" &&
      bytes.subarray(0, 5).toString() === "%PDF-") ||
    (extension === "png" &&
      contentType === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (["jpg", "jpeg"].includes(extension || "") &&
      contentType === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216) ||
    (extension === "txt" && contentType === "text/plain" && !bytes.includes(0));
  if (!valid)
    throw new EmailError(
      "Supported attachments: valid PDF, PNG, JPEG, or plain-text files.",
    );
}
export async function storeAttachment(
  messageId: string,
  name: string,
  type: string,
  bytes: Buffer,
  estimateId?: string,
) {
  validateAttachment(name, type, bytes);
  const id = randomUUID();
  const safeName = name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);
  let pathname: string | undefined;
  try {
    const blob = await put(`email/${messageId}/${id}/${safeName}`, bytes, {
      ...emailBlobOptions(),
      access: "private",
      contentType: type,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    pathname = blob.pathname;
    await emailDb.transaction(async (tx) => {
      const message = await tx.execute(
        query`SELECT state,retry_safe FROM email_messages WHERE id=${messageId}::uuid AND user_id='dashboard' FOR UPDATE`,
      );
      if (
        !message.rows[0] ||
        !message.rows[0].retry_safe ||
        !["draft", "failed"].includes(String(message.rows[0].state))
      )
        throw new EmailError("Attachments cannot change after sending starts.");
      const count = await tx.execute(
        query`SELECT count(*)::int AS count, COALESCE(sum(size),0)::int AS size FROM email_attachments WHERE message_id=${messageId}::uuid AND user_id='dashboard'`,
      );
      if (
        Number(count.rows[0].count) >= MAX_FILES ||
        Number(count.rows[0].size) + bytes.length > MAX_TOTAL
      )
        throw new EmailError("Maximum five attachments and 9 MB total.");
      await tx.execute(
        query`INSERT INTO email_attachments (id,message_id,name,pathname,content_type,size,estimate_id) VALUES (${id}::uuid,${messageId}::uuid,${safeName},${pathname},${type},${bytes.length},${estimateId || null}::uuid)`,
      );
    });
    return {
      id,
      message_id: messageId,
      name: safeName,
      content_type: type,
      size: bytes.length,
      estimate_id: estimateId || null,
    };
  } catch (error) {
    if (pathname)
      await del(pathname, emailBlobOptions()).catch(() => undefined);
    if (error instanceof EmailError) throw error;
    throw new EmailError(
      "Private attachment storage is unavailable. Connect a private Blob store; public storage is never used.",
    );
  }
}
export async function attachmentBytes(file: AttachmentRow) {
  const result = await get(file.pathname, {
    ...emailBlobOptions(),
    access: "private",
    useCache: false,
  });
  if (!result || result.statusCode !== 200)
    throw new EmailError(`Attachment unavailable: ${file.name}`);
  if (result.blob.size !== file.size || result.blob.size > MAX_ATTACHMENT)
    throw new EmailError("Attachment size mismatch.");
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}
