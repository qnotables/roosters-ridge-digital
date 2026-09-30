import "server-only";
import { EmailError } from "@/lib/email-workspace-db";

export function emailBlobOptions() {
  const token = process.env.RRD_EMAIL_BLOB_READ_WRITE_TOKEN;
  if (!token)
    throw new EmailError(
      "Private email storage is not configured. Connect a separate private Blob store using the RRD_EMAIL_BLOB prefix; keep the existing public site store unchanged.",
      409,
    );
  return { token };
}
