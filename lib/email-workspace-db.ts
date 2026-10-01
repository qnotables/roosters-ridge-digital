import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { hasDashboardAccess } from "@/lib/admin-auth";
import { getAuthSession } from "@/lib/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
export const emailDb = drizzle(pool);
export { sql as query };
export class EmailError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function requireEmailAccess() {
  if (!(await hasDashboardAccess()))
    throw new EmailError("Dashboard access required.", 401);
}
export async function emailSettings() {
  const result = await emailDb.execute(
    sql`SELECT sender, staff_emails, incoming_address, last_received_at FROM email_settings WHERE id=1`,
  );
  const row = result.rows[0] as
    { sender: string; staff_emails: string[]; incoming_address: string; last_received_at: string | null } | undefined;
  return { sender: row?.sender || "", staffEmails: row?.staff_emails || [], incomingAddress: row?.incoming_address || "", lastReceivedAt: row?.last_received_at || null };
}
export function approvedEmailStaff(
  user:
    | { id: string; email: string; name: string; emailVerified: boolean }
    | null
    | undefined,
  approvedEmails: string[],
) {
  if (
    !user?.emailVerified ||
    !approvedEmails.includes(user.email.toLowerCase())
  )
    return null;
  return { id: user.id, email: user.email, name: user.name };
}
export async function emailStaffAccess() {
  await requireEmailAccess();
  const session = await getAuthSession(true);
  if (!session?.user) return { staff: null, staffAccount: null };
  const settings = await emailSettings();
  const user = session.user;
  return {
    staff: approvedEmailStaff(user, settings.staffEmails),
    staffAccount: {
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      approved: settings.staffEmails.includes(user.email.toLowerCase()),
    },
  };
}
export async function currentStaff() {
  return (await emailStaffAccess()).staff;
}
export async function requireStaff() {
  const staff = await currentStaff();
  if (!staff)
    throw new EmailError(
      "Sign in with a verified, approved individual staff account before sending.",
      403,
    );
  return staff;
}
export function checkEmailOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  // Next.js can expose an internal localhost URL behind the preview's reverse proxy.
  const publicOrigin = host ? new URL(`${requestUrl.protocol}//${host}`).origin : requestUrl.origin;
  if (!origin || (origin !== requestUrl.origin && origin !== publicOrigin))
    throw new EmailError("Invalid request origin.", 403);
}
export function emailErrorResponse(error: unknown) {
  return Response.json(
    {
      error: error instanceof Error ? error.message : "Email operation failed.",
    },
    {
      status: error instanceof EmailError ? error.status : 400,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export type MessageRow = {
  id: string;
  user_id: string;
  sender_id: string | null;
  sender_email: string | null;
  recipients: { to: string[]; cc: string[]; bcc: string[] };
  subject: string;
  html: string;
  plain_text: string;
  lead_id: string | null;
  estimate_id: string | null;
  project_name: string;
  state: string;
  provider_id: string | null;
  attempt_id: string | null;
  attempt_at: string | null;
  frozen_payload: FrozenPayload | null;
  estimate_snapshot: {
    lines: string[];
    estimateNumber: string;
    contact: string;
  } | null;
  retry_safe: boolean;
  last_error: string | null;
  created_at: string;
  accepted_at: string | null;
  event_at: string | null;
  direction: "inbound" | "outbound";
  conversation_id: string;
  rfc_message_id: string | null;
  in_reply_to: string | null;
  reference_ids: string[];
  reply_address: string | null;
  reply_to_message_id: string | null;
  received_at: string | null;
  read_at: string | null;
  archived: boolean;
};
export type AttachmentRow = {
  id: string;
  message_id: string;
  name: string;
  pathname: string;
  content_type: string;
  size: number;
  estimate_id: string | null;
};
export type FrozenPayload = {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  headers?: Record<string, string>;
  files: AttachmentRow[];
};
export async function findMessage(id: string) {
  const rows = await emailDb.execute(
    sql`SELECT * FROM email_messages WHERE id=${id}::uuid AND user_id='dashboard'`,
  );
  return rows.rows[0] as MessageRow | undefined;
}
export async function findAttachments(messageId: string) {
  const result = await emailDb.execute(
    sql`SELECT * FROM email_attachments WHERE message_id=${messageId}::uuid AND user_id='dashboard' ORDER BY created_at`,
  );
  return result.rows as AttachmentRow[];
}
