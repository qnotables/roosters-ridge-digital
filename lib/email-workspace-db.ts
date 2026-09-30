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
    sql`SELECT sender, staff_emails FROM email_settings WHERE id=1`,
  );
  const row = result.rows[0] as
    { sender: string; staff_emails: string[] } | undefined;
  return { sender: row?.sender || "", staffEmails: row?.staff_emails || [] };
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
export async function currentStaff() {
  await requireEmailAccess();
  const session = await getAuthSession();
  if (!session?.user) return null;
  const settings = await emailSettings();
  return approvedEmailStaff(session.user, settings.staffEmails);
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
  if (!origin || origin !== new URL(request.url).origin)
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
