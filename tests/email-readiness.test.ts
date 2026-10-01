import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ incomingAddress: "", lastReceivedAt: null as string | null, sender: "sender@example.test", staffEmails: ["staff@example.test"], replyTo: "reply@example.test", list: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/email-workspace-db", async () => {
  const { sql } = await import("drizzle-orm");
  return { query: sql, emailSettings: async () => ({ sender: state.sender, staffEmails: state.staffEmails, incomingAddress: state.incomingAddress, lastReceivedAt: state.lastReceivedAt }), emailDb: { execute: async () => ({ rows: [{ founder_name: "Staff", founder_title: "Founder", email: state.replyTo }] }) } };
});
vi.mock("resend", () => ({ Resend: class { domains = { list: state.list, get: state.get }; } }));
import { emailReadiness } from "@/lib/email-workspace-provider";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("RESEND_API_KEY", "test-only");
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
  vi.stubEnv("RRD_EMAIL_BLOB_READ_WRITE_TOKEN", "");
  state.incomingAddress = "";
  state.lastReceivedAt = null;
  state.sender = "sender@example.test";
  state.replyTo = "reply@example.test";
  state.staffEmails = ["staff@example.test"];
  state.list.mockResolvedValue({ data: { data: [{ id: "domain", name: "example.test" }] }, error: null });
  state.get.mockResolvedValue({ data: { name: "example.test", status: "verified", records: [], capabilities: { sending: "enabled" } }, error: null });
});

describe("independent email setup requirements", () => {
  it("preserves business Reply-To until a signed incoming message verifies the inbox", async () => {
    state.incomingAddress = "inbox@example.test";
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "test-secret");
    expect((await emailReadiness()).replyTo).toBe("reply@example.test");
    expect((await emailReadiness()).receivingVerified).toBe(false);
    state.lastReceivedAt = "2026-09-30T12:00:00Z";
    const readiness = await emailReadiness();
    expect(readiness.replyTo).toBe("inbox@example.test");
    expect(readiness.receivingVerified).toBe(true);
    expect(readiness.signature).toContain("reply@example.test");
    expect(readiness.signature).not.toContain("inbox@example.test");
  });
  it("allows ordinary sends without attachment storage or delivery webhooks", async () => {
    const ready = await emailReadiness();
    expect(ready.ready).toBe(true);
    expect(ready.missing).toEqual([]);
    expect(ready.attachmentsReady).toBe(false);
    expect(ready.deliveryTrackingReady).toBe(false);
    expect(ready.signature).toContain("Staff");
    expect(JSON.stringify(ready)).not.toContain("test-only");
  });
  it("requires sending credentials and the configured monitored Reply-To", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    state.replyTo = "";
    const ready = await emailReadiness();
    expect(ready.ready).toBe(false);
    expect(ready.missing).toContain("RESEND_API_KEY");
    expect(ready.missing).toContain("Monitored Reply-To email in business profile");
  });
  it("requires an actual sender without inventing addresses", async () => {
    state.sender = "";
    state.staffEmails = [];
    const ready = await emailReadiness();
    expect(ready.ready).toBe(false);
    expect(ready.sender).toBe("");
    expect(ready.missing).toContain("Configured sender address");
    expect(ready.missing).not.toContain("Approved staff email addresses");
  });
  it("allows a configured single sender without any approved staff accounts", async () => {
    state.staffEmails = [];
    expect((await emailReadiness()).ready).toBe(true);
  });
  it("blocks a known unauthorized sender domain", async () => {
    state.get.mockResolvedValue({ data: { name: "example.test", status: "failed", records: [], capabilities: { sending: "disabled" } }, error: null });
    expect((await emailReadiness()).missing).toContain("Verified sending domain");
    state.list.mockResolvedValue({ data: { data: [] }, error: null });
    expect((await emailReadiness()).missing).toContain("Sender domain registered in Resend");
  });
  it("does not require domain-read privileges for a sending-only credential", async () => {
    state.list.mockResolvedValue({ data: null, error: { message: "restricted key" } });
    const ready = await emailReadiness();
    expect(ready.ready).toBe(true);
    expect(ready.domainStatus).toBe("verification unavailable");
    expect(ready.providerError).toContain("Resend enforces sender authorization");
  });
});
