import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Pool } from "pg";

const base = process.env.EMAIL_TEST_URL || "http://localhost:3000";
const key = process.env.ADMIN_DASHBOARD_KEY?.trim();
if (!key)
  throw new Error(
    "Dashboard credential unavailable for protected HTTP smoke check.",
  );
const cookie = `admin_dashboard_access=${createHmac("sha256", key).update("roosters-ridge-dashboard-access").digest("hex")}`;
const headers = {
  Cookie: cookie,
  Origin: base,
  "Content-Type": "application/json",
};
let draftId: string | undefined;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  for (const path of [
    "/api/admin/email",
    "/api/admin/email/attachments?id=11111111-1111-4111-8111-111111111111",
  ])
    assert.equal((await fetch(`${base}${path}`)).status, 401);
  const response = await fetch(`${base}/api/admin/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "draft",
      draft: {
        recipients: { to: ["delivered@resend.dev"], cc: [], bcc: [] },
        subject: "Automated draft persistence check",
        html: '<p>Test draft only</p><img src="https://tracking.invalid/pixel">',
      },
    }),
  });
  const draft = await response.json();
  assert.equal(response.status, 200, JSON.stringify(draft));
  draftId = draft.id;
  const row = await pool.query(
    "SELECT html,state FROM email_messages WHERE id=$1 AND user_id=$2",
    [draftId, "dashboard"],
  );
  assert.equal(row.rows[0].html, "<p>Test draft only</p>");
  assert.equal(row.rows[0].state, "draft");
  const denied = await fetch(`${base}/api/admin/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "send", id: draftId }),
  });
  assert.equal(denied.status, 403);
  const forged = await fetch(`${base}/api/webhooks/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": "fake",
      "svix-signature": "forged",
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
    },
    body: "{}",
  });
  assert.ok([401, 503].includes(forged.status));
  const workspace = await fetch(`${base}/api/admin/email`, {
    headers: { Cookie: cookie },
  });
  const data = await workspace.json();
  assert.equal(workspace.status, 200, JSON.stringify(data));
  assert.ok(data.messages.some((m: { id: string }) => m.id === draftId));
  assert.equal(typeof data.setup.ready, "boolean");
  assert.equal(typeof data.setup.attachmentsReady, "boolean");
  assert.equal(typeof data.setup.deliveryTrackingReady, "boolean");
  console.log(
    "Protected HTTP checks passed: authorization, sanitized persistent draft, shared-key send denial, forged webhook rejection, and setup gating. No emails sent.",
  );
} finally {
  if (draftId)
    await pool.query(
      "DELETE FROM email_messages WHERE id=$1 AND user_id=$2 AND subject=$3 AND state=$4",
      [draftId, "dashboard", "Automated draft persistence check", "draft"],
    );
  await pool.end();
}
