import { cleanHtml, EMAIL } from "@/lib/email-workspace-shared";

export function messageIds(value: string | null | undefined) {
  return [...new Set((value || "").match(/<[^<>\s\r\n]{1,900}>/g) || [])].slice(-100);
}
export function canonicalMessageId(value: string | null | undefined) {
  if (!value || /[\r\n]/.test(value)) return null;
  const trimmed = value.trim();
  return messageIds(trimmed)[0] || (/^[^<>\s]{1,900}@[^<>\s]+$/.test(trimmed) ? `<${trimmed}>` : null);
}
export function headerValue(headers: Record<string, string> | null | undefined, name: string) {
  return Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] || "";
}
export function mailboxAddress(value: string) {
  const address = (value.match(/<([^<>]+)>/)?.[1] || value).trim().toLowerCase();
  return EMAIL.test(address) && !/[\r\n]/.test(address) ? address : "";
}
export function replySubject(subject: string) {
  return /^re\s*:/i.test(subject) ? subject : `Re: ${subject}`;
}
export function safeEmailHtml(html: string) {
  return cleanHtml(html);
}
export function outboundThreadHeaders(id: string, sender: string, parentId?: string | null, references: string[] = []) {
  const headers: Record<string, string> = { "Message-ID": `<rrd-${id}@${sender.split("@")[1]}>` };
  const parent = canonicalMessageId(parentId);
  if (parent) {
    headers["In-Reply-To"] = parent;
    headers.References = [...new Set([...references.flatMap(messageIds), parent])].slice(-100).join(" ");
  }
  return headers;
}
export const INBOUND_FILE_LIMIT = 3_000_000;
export const INBOUND_TOTAL_LIMIT = 9_000_000;
export async function boundedAttachment(response: Response, limit = INBOUND_FILE_LIMIT) {
  if (!response.ok || !response.body) throw new Error("Attachment download failed; retry.");
  if (Number(response.headers.get("content-length") || 0) > limit) throw new Error("Attachment size exceeds limit.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Attachment size exceeds limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
