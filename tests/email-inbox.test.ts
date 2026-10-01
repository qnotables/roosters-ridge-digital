import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { createHmac } from "node:crypto";
import { Resend } from "resend";
const state = vi.hoisted(() => ({ allowed: true, incoming: "inbox@example.test", received: {} as any, parent: null as any, stored: false, duplicateRfc: false, execute: vi.fn(), getReceived: vi.fn(), getAttachment: vi.fn(), fetch: vi.fn(), verify: vi.fn(), found: null as any, file: null as any, domainList: vi.fn(), domainGet: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ hasDashboardAccess: async () => state.allowed }));
vi.mock("@/lib/email-workspace-db", async () => {
  const actual = await vi.importActual<any>("@/lib/email-workspace-db");
  return { ...actual, emailDb: { execute: state.execute, transaction: async (fn: any) => fn({ execute: state.execute }) }, emailSettings: async () => ({ incomingAddress: state.incoming }), requireEmailAccess: async () => { if (!state.allowed) throw new actual.EmailError("Unauthorized", 401); }, findMessage: async () => state.found };
});
vi.mock("@/lib/email-workspace-provider", () => ({ emailProvider: () => ({ emails: { receiving: { get: state.getReceived, attachments: { get: state.getAttachment } } }, webhooks: { verify: state.verify }, domains: { list: state.domainList, get: state.domainGet } }) }));
import { ingestReceivedEmail } from "@/lib/email-inbox-ingest";
import { createReplyDraft, setConversationState, associateConversation, saveReceivingAddress } from "@/lib/email-inbox-service";
import { messageIds, canonicalMessageId, safeEmailHtml, outboundThreadHeaders, boundedAttachment } from "@/lib/email-inbox-shared";
import { GET as inboxGet, POST as inboxPost } from "@/app/api/admin/email/inbox/route";
import { GET as download } from "@/app/api/admin/email/inbox/attachments/route";
import { POST as webhook } from "@/app/api/webhooks/resend/route";
const dialect = new PgDialect();
const queries = () => state.execute.mock.calls.map(([q]) => dialect.sqlToQuery(q));
const id = "11111111-1111-4111-8111-111111111111";
const conversation = "22222222-2222-4222-8222-222222222222";
const quote = "33333333-3333-4333-8333-333333333333";
beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllEnvs();
  state.allowed = true; state.incoming = "inbox@example.test"; state.stored = false; state.duplicateRfc = false; state.parent = null; state.found = null; state.file = null;
  state.received = { id: "received-1", from: "Test Sender <sender@example.test>", to: [state.incoming], cc: ["copy@example.test"], bcc: [], received_for: [state.incoming], subject: "Quote follow-up", html: '<p>Hello</p><script>evil()</script><img src="https://tracking.invalid/pixel">', text: "Hello", headers: { "Message-ID": "<incoming@example.test>", "In-Reply-To": "<parent@example.test>", References: "<older@example.test> <parent@example.test>" }, message_id: "<incoming@example.test>", reply_to: ["reply@example.test"], created_at: "2026-09-30T12:00:00Z", attachments: [] };
  state.getReceived.mockImplementation(async () => ({ data: state.received, error: null }));
  state.verify.mockImplementation(args => new Resend("test-only").webhooks.verify(args));
  state.domainList.mockResolvedValue({ data: { data: [{ id: "domain", name: "example.test" }] }, error: null });
  state.domainGet.mockResolvedValue({ data: { status: "verified", capabilities: { receiving: "enabled" }, records: [{ record: "Receiving", status: "verified" }] }, error: null });
  vi.stubGlobal("fetch", state.fetch);
  state.execute.mockImplementation(async q => {
    const { sql } = dialect.sqlToQuery(q);
    if (sql.startsWith("SELECT id FROM email_messages")) return { rows: state.stored || (sql.includes("rfc_message_id") && state.duplicateRfc) ? [{ id }] : [] };
    if (sql.startsWith("SELECT id,conversation_id")) return { rows: state.parent ? [state.parent] : [] };
    if (sql.startsWith("INSERT INTO email_messages") && sql.includes("'inbound'")) state.stored = true;
    if (sql.startsWith("SELECT reply_to_message_id")) return { rows: [] };
    if (sql.startsWith("SELECT a.name")) return { rows: state.file ? [state.file] : [] };
    if (sql.startsWith("SELECT count(DISTINCT")) return { rows: [{ unread: 1 }] };
    if (sql.startsWith("UPDATE email_messages SET lead_id")) return { rows: [{ id }] };
    if (sql.startsWith("SELECT id FROM leads") || sql.startsWith("SELECT id FROM pricing_estimates")) return { rows: [{ id }] };
    return { rows: [] };
  });
});
describe("incoming bodies, threading, deduplication, and retries", () => {
  it("retrieves actual incoming content rather than delivery events and preserves headers and bodies", async () => {
    expect(await ingestReceivedEmail("received-1", "event-1")).toBe("processed");
    expect(state.getReceived).toHaveBeenCalledWith("received-1", { html_format: "cid" });
    const insert = queries().find(q => q.sql.startsWith("INSERT INTO email_messages"))!;
    expect(insert.params).toContain(state.received.html);
    expect(insert.params).toContain("<p>Hello</p>");
    expect(insert.params).toContain(state.received.text);
    expect(insert.params).toContain("<incoming@example.test>");
    expect(insert.params).toContain("reply@example.test");
    expect(insert.params).toContain(JSON.stringify(state.received.headers));
    expect(insert.params.some(p => p instanceof Date && p.toISOString() === state.received.created_at.replace("Z", ".000Z"))).toBe(true);
    expect(queries().some(q => q.sql.includes("last_received_at=now()"))).toBe(true);
  });
  it("inherits associations only from an explicit referenced message", async () => {
    state.parent = { id, conversation_id: conversation, rfc_message_id: "<parent@example.test>", lead_id: id, estimate_id: quote, project_name: "Saved quote" };
    await ingestReceivedEmail("received-1", "event-1");
    const insert = queries().find(q => q.sql.startsWith("INSERT INTO email_messages"))!;
    expect(insert.params).toContain(conversation); expect(insert.params).toContain(quote);
    const lookup = queries().find(q => q.sql.startsWith("SELECT id,conversation_id"))!;
    expect(lookup.sql).toContain("rfc_message_id IN"); expect(lookup.sql).not.toMatch(/subject|sender_email/);
  });
  it("does not link a same-subject or same-sender message to a quote", async () => {
    state.received.headers = {}; state.received.message_id = "<unrelated@example.test>";
    await ingestReceivedEmail("received-1", "event-1");
    const insert = queries().find(q => q.sql.startsWith("INSERT INTO email_messages"))!;
    expect(insert.params).not.toContain(quote);
    expect(queries().some(q => q.sql.includes("lower(email)"))).toBe(false);
  });
  it("merges reordered children by message references, not subject", async () => {
    await ingestReceivedEmail("received-1", "event-1");
    const merge = queries().find(q => q.sql.startsWith("UPDATE email_messages SET conversation_id"))!;
    expect(merge.sql).toContain("in_reply_to="); expect(merge.sql).toContain("reference_ids @>"); expect(merge.sql).not.toMatch(/subject|sender_email/);
    expect(merge.params).toContain("<incoming@example.test>");
  });
  it("deduplicates retried provider delivery before another content download", async () => {
    await ingestReceivedEmail("received-1", "event-1");
    expect(await ingestReceivedEmail("received-1", "event-2")).toBe("duplicate");
    expect(state.getReceived).toHaveBeenCalledTimes(1);
    expect(queries().filter(q => q.sql.startsWith("INSERT INTO email_messages"))).toHaveLength(1);
  });
  it("deduplicates the RFC Message-ID even if a new provider event ID is used", async () => {
    state.duplicateRfc = true;
    expect(await ingestReceivedEmail("another-provider-id", "event-2")).toBe("duplicate");
    expect(queries().some(q => q.sql.startsWith("INSERT INTO email_messages"))).toBe(false);
  });
  it("returns retryable errors without storing a partial message when receiving is unavailable", async () => {
    state.getReceived.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    await expect(ingestReceivedEmail("received-1", "event-1")).rejects.toThrow(/retry/);
    expect(state.stored).toBe(false);
  });
  it("ignores account email addressed to another inbox", async () => {
    state.received.to = ["other@example.test"]; state.received.cc = []; state.received.received_for = [];
    expect(await ingestReceivedEmail("received-1", "event-1")).toBe("unrelated"); expect(state.stored).toBe(false);
  });
  it("downloads attachments privately and never persists provider download URLs", async () => {
    state.received.attachments = [{ id: "file-1", filename: "test.txt", size: 4, content_type: "text/plain" }];
    state.getAttachment.mockResolvedValue({ data: { download_url: "https://provider.invalid/signed" }, error: null });
    state.fetch.mockResolvedValue(new Response("TEST"));
    await ingestReceivedEmail("received-1", "event-1");
    const insert = queries().find(q => q.sql.startsWith("INSERT INTO email_inbound_attachments"))!;
    expect(insert.params).toContain(Buffer.from("TEST").toString("base64"));
    expect(JSON.stringify(insert.params)).not.toContain("signed");
    expect(state.fetch.mock.calls[0][1].redirect).toBe("error");
  });
  it("retains oversized attachment metadata without downloading active content", async () => {
    state.received.attachments = [{ id: "file-1", filename: "large.html", size: 4_000_000, content_type: "text/html" }];
    await ingestReceivedEmail("received-1", "event-1");
    expect(state.getAttachment).not.toHaveBeenCalled();
    const insert = queries().find(q => q.sql.startsWith("INSERT INTO email_inbound_attachments"))!;
    expect(insert.params).toContain("large.html"); expect(insert.params.some(p => typeof p === "string" && p.includes("Not downloaded"))).toBe(true);
  });
  it("rejects oversized streamed files even without a Content-Length", async () => {
    await expect(boundedAttachment(new Response("12345"), 4)).rejects.toThrow(/size/);
  });
});
describe("authorized everyday inbox controls", () => {
  it("blocks inbox, content, attachments, and commands without staff dashboard authorization", async () => {
    state.allowed = false;
    expect((await inboxGet(new Request("https://app.test/api/admin/email/inbox"))).status).toBe(401);
    expect((await download(new Request(`https://app.test/api/admin/email/inbox/attachments?id=${id}`))).status).toBe(401);
    expect((await inboxPost(new Request("https://app.test/api/admin/email/inbox", { method: "POST", headers: { origin: "https://app.test" }, body: JSON.stringify({ action: "archive", conversationId: conversation }) }))).status).toBe(401);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("blocks cross-origin inbox mutations", async () => {
    expect((await inboxPost(new Request("https://app.test/api/admin/email/inbox", { method: "POST", headers: { origin: "https://evil.test" }, body: "{}" }))).status).toBe(403);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("supports durable read/unread and archive/restore without deleting mail", async () => {
    state.stored = true;
    for (const action of ["read", "unread", "archive", "restore"] as const) await setConversationState(conversation, action);
    const updates = queries().filter(q => q.sql.startsWith("UPDATE email_messages"));
    expect(updates[0].params.some(p => p instanceof Date)).toBe(true);
    expect(updates[1].params).toContain(null);
    expect(updates[2].params).toContain(true); expect(updates[3].params).toContain(false);
    expect(updates.every(q => q.sql.includes("user_id='dashboard'"))).toBe(true);
    expect(queries().some(q => q.sql.startsWith("DELETE"))).toBe(false);
  });
  it("searches sender, subject, recipient, and body using escaped parameterized SQL", async () => {
    const response = await inboxGet(new Request("https://app.test/api/admin/email/inbox?search=%25_TEST"));
    expect(response.status).toBe(200);
    const search = queries().find(q => q.sql.startsWith("WITH conversations"))!;
    expect(search.sql).toContain("m.plain_text ILIKE"); expect(search.sql).toContain("m.sender_email ILIKE"); expect(search.sql).toContain("m.recipients::text ILIKE");
    expect(search.params).toContain("%\\%\\_TEST%"); expect(search.sql).not.toContain("_TEST");
  });
  it("forces private attachments to download as untrusted bytes with no public URL", async () => {
    state.file = { name: 'untrusted.html', size: 4, content_base64: Buffer.from("TEST").toString("base64"), blocked_reason: null };
    const response = await download(new Request(`https://app.test/api/admin/email/inbox/attachments?id=${id}`));
    expect(response.status).toBe(200); expect(await response.text()).toBe("TEST");
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream"); expect(response.headers.get("Content-Disposition")).toContain("attachment;"); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  });
  it("returns 404 for missing attachments and refuses quarantined downloads", async () => {
    expect((await download(new Request(`https://app.test/api/admin/email/inbox/attachments?id=${id}`))).status).toBe(404);
    state.file = { blocked_reason: "Too large", content_base64: null };
    expect((await download(new Request(`https://app.test/api/admin/email/inbox/attachments?id=${id}`))).status).toBe(409);
  });
  it("creates a saved reply with original subject, correct recipient, and saved quote association", async () => {
    state.found = { id, direction: "inbound", rfc_message_id: "<original@example.test>", subject: "Quote 123", reply_address: "reply@example.test", sender_email: "sender@example.test", conversation_id: conversation, reference_ids: ["<ancestor@example.test>"], lead_id: id, estimate_id: quote, project_name: "Saved project" };
    expect(await createReplyDraft(id)).toHaveProperty("id");
    const insert = queries().find(q => q.sql.startsWith("INSERT INTO email_messages"))!;
    expect(insert.params).toContain("Re: Quote 123"); expect(insert.params).toContain(conversation); expect(insert.params).toContain(quote); expect(insert.params).toContain("<original@example.test>");
    expect(insert.params).toContain(JSON.stringify({ to: ["reply@example.test"], cc: [], bcc: [] }));
  });
  it("does not fabricate original threading IDs for legacy mail", async () => {
    state.found = { direction: "inbound", rfc_message_id: null };
    await expect(createReplyDraft(id)).rejects.toThrow(/Message-ID/);
  });
  it("allows explicit association only with existing saved records", async () => {
    await associateConversation(conversation, id, quote);
    expect(queries().filter(q => q.sql.startsWith("SELECT id FROM"))).toHaveLength(2);
    expect(queries().find(q => q.sql.startsWith("UPDATE email_messages SET lead_id"))?.sql).toContain("direction='inbound'");
  });
  it("verifies receiving domains before saving without mutating provider or DNS", async () => {
    await saveReceivingAddress("inbox@example.test");
    expect(state.domainGet).toHaveBeenCalledWith("domain");
    state.domainGet.mockResolvedValue({ data: { status: "verified", capabilities: { receiving: "disabled" }, records: [] }, error: null });
    await expect(saveReceivingAddress("inbox@example.test")).rejects.toThrow(/Receiving is not verified/);
  });
});
describe("webhook signatures and safe email rendering", () => {
  function signedRequest(valid: boolean) {
    const secret = Buffer.from("test-webhook-secret-only").toString("base64");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", `whsec_${secret}`);
    const timestamp = String(Math.floor(Date.now()/1000));
    const payload = JSON.stringify({ type: "email.received", created_at: new Date().toISOString(), data: { email_id: "received-1" } });
    const signature = createHmac("sha256", Buffer.from(secret, "base64")).update(`evt-test.${timestamp}.${payload}`).digest("base64");
    return new Request("https://app.test/api/webhooks/resend", { method: "POST", headers: { "svix-id": "evt-test", "svix-timestamp": timestamp, "svix-signature": valid ? `v1,${signature}` : "v1,forged" }, body: payload });
  }
  it("verifies a signed received event before retrieving and saving its content", async () => {
    expect((await webhook(signedRequest(true))).status).toBe(200); expect(state.getReceived).toHaveBeenCalledTimes(1);
  });
  it("rejects forged received events without content retrieval", async () => {
    expect((await webhook(signedRequest(false))).status).toBe(401); expect(state.getReceived).not.toHaveBeenCalled();
  });
  it("returns 503 so genuine webhook delivery retries after transient content errors", async () => {
    state.getReceived.mockResolvedValue({ data: null, error: { message: "temporary error" } });
    expect((await webhook(signedRequest(true))).status).toBe(503); expect(state.stored).toBe(false);
  });
  it("blocks scripts, pixels, event handlers, forms, styles and javascript links", () => {
    const html = safeEmailHtml('<p onclick="evil()">Hello</p><img src="https://remote.invalid"><script>evil()</script><iframe src="https://evil.invalid"></iframe><form><input></form><style>p{display:none}</style><a href="javascript:evil()">Click</a>');
    expect(html).toContain("Hello"); expect(html).not.toMatch(/onclick|<img|<script|<iframe|<form|<style|javascript:/);
  });
  it("normalizes RFC IDs and drops unsafe header injection", () => {
    expect(messageIds("<one@example.test> <two@example.test>")).toHaveLength(2);
    expect(canonicalMessageId("one@example.test")).toBe("<one@example.test>");
    expect(canonicalMessageId("<one@example.test>\r\nBcc: evil@example.test")).toBe(null);
    const headers = outboundThreadHeaders(id, "sender@example.test", "<parent@example.test>", ["<ancestor@example.test>"]);
    expect(headers["In-Reply-To"]).toBe("<parent@example.test>"); expect(headers.References).toBe("<ancestor@example.test> <parent@example.test>"); expect(headers["Message-ID"]).toContain(id);
  });
});
