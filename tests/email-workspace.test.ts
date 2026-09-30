import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { createHmac } from "node:crypto";
import { Resend } from "resend";
import { sql } from "drizzle-orm";
import {
  validateDraft,
  cleanHtml,
  nextDeliveryState,
} from "@/lib/email-workspace-shared";
import { customerEstimateFields, estimatePdf } from "@/lib/email-estimate-pdf";
import type { EstimateRecord } from "@/lib/pricing-shared";

const state = vi.hoisted(() => ({
  message: {} as Record<string, any>,
  attachments: [] as any[],
  events: new Set<string>(),
  suppressed: [] as string[],
  allowed: true,
  staff: true,
  send: vi.fn(),
  verify: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  requests: 0,
}));
const dialect = new PgDialect();
vi.mock("@/lib/auth", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({
  hasDashboardAccess: async () => state.allowed,
}));
vi.mock("@/lib/email-workspace-db", async () => {
  const actual = await vi.importActual<any>("@/lib/email-workspace-db");
  return {
    ...actual,
    emailDb: { execute: state.execute, transaction: state.transaction },
    query: sql,
    requireEmailAccess: async () => {
      if (!state.allowed) throw new actual.EmailError("Unauthorized", 401);
    },
    requireStaff: async () => {
      if (!state.allowed || !state.staff)
        throw new actual.EmailError("Staff sign-in required", 403);
      return { id: "staff-1", email: "staff@example.test", name: "Staff" };
    },
    findMessage: async () => state.message,
    findAttachments: async () => state.attachments,
  };
});
vi.mock("@/lib/email-workspace-provider", () => ({
  emailReadiness: async () => ({
    ready: true,
    sender: "sender@example.test",
    replyTo: "reply@example.test",
    signature: "<p>RRD</p>",
    missing: [],
  }),
  emailProvider: () => ({
    emails: { send: state.send },
    webhooks: { verify: state.verify },
  }),
}));
vi.mock("@/lib/pricing", () => ({ getEstimateById: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }));
import {
  saveEmailDraft,
  sendEmailDraft,
  createEstimateDraft,
  attachEstimate,
} from "@/lib/email-workspace-service";
import { getEstimateById } from "@/lib/pricing";
import { get, put } from "@vercel/blob";
import {
  validateAttachment,
  attachmentBytes,
} from "@/lib/email-workspace-attachments";
import { POST as webhook } from "@/app/api/webhooks/resend/route";
import { GET as download } from "@/app/api/admin/email/attachments/route";

const id = "b7dc6dfe-6f25-40da-bcfa-2189bda0c441";
const draft = {
  recipients: { to: ["delivered@resend.dev"], cc: [], bcc: [] },
  subject: "A customer message",
  html: "<p>Hello</p>",
  plainText: "Hello",
};
const fixture = {
  id: "c323f8e6-81c5-471e-8678-dc1f9997aa00",
  estimateNumber: "RRD-TEST",
  clientName: "Test customer",
  company: "Test",
  email: "delivered@resend.dev",
  projectName: "Test project",
  projectOverview: "Public scope",
  platformName: "Saved platform",
  platformPrice: 150,
  totalPrice: 222,
  discount: 0,
  tax: 0,
  depositAmount: 22,
  remainingBalance: 200,
  recurringTotal: 0,
  internalNotes: "PRIVATE_NOTES",
  internalCost: 19,
  estimatedHoursLow: 12,
  items: [
    {
      label: "Saved capability",
      quantity: 1,
      unitPrice: 72,
      discount: 0,
      isIncluded: false,
      description: "Customer scope",
      clientNote: "Public note",
      internalNote: "PRIVATE_MARGIN",
    },
  ],
  recurringItems: [],
  assumptions: "Public assumptions",
  exclusions: "Public exclusions",
  timeline: "Public timeline",
  nextSteps: "Public next steps",
  createdAt: "2026-09-30",
  expirationDate: "2026-10-30",
} as unknown as EstimateRecord;

beforeEach(() => {
  process.env.RRD_EMAIL_BLOB_READ_WRITE_TOKEN = "test-private-token";
  vi.clearAllMocks();
  state.events.clear();
  state.suppressed = [];
  state.allowed = true;
  state.staff = true;
  state.requests = 0;
  state.attachments = [];
  state.message = {
    id,
    user_id: "dashboard",
    recipients: draft.recipients,
    subject: draft.subject,
    html: draft.html,
    plain_text: "Hello",
    state: "draft",
    sender_id: null,
    attempt_id: null,
    attempt_at: null,
    frozen_payload: null,
    retry_safe: true,
    estimate_id: null,
    provider_id: null,
    event_at: null,
  };
  state.send.mockResolvedValue({ data: { id: "provider-test" }, error: null });
  state.transaction.mockImplementation(async (fn: any) =>
    fn({ execute: state.execute }),
  );
  state.execute.mockImplementation(async (q: any) => {
    const { sql: text, params: values } = dialect.sqlToQuery(q);
    const params = values as any[];
    if (text.startsWith("SELECT pg_advisory")) return { rows: [] };
    if (text.startsWith("SELECT * FROM email_messages"))
      return { rows: [state.message] };
    if (
      text.startsWith("SELECT state,retry_safe") ||
      text.startsWith("SELECT state FROM")
    )
      return { rows: [state.message] };
    if (text.startsWith("SELECT count(*) FILTER"))
      return { rows: [{ minute: 0, day: 0 }] };
    if (text.includes("FROM email_send_requests"))
      return { rows: [{ count: state.requests }] };
    if (text.startsWith("INSERT INTO email_send_requests")) {
      state.requests++;
      return { rows: [] };
    }
    if (text.startsWith("SELECT * FROM email_attachments"))
      return { rows: state.attachments };
    if (text.startsWith("SELECT email FROM email_suppressions"))
      return { rows: state.suppressed.map((email) => ({ email })) };
    if (text.startsWith("UPDATE email_messages SET state='queued'"))
      Object.assign(state.message, {
        state: "queued",
        sender_id: params[0],
        sender_email: params[1],
        attempt_id: params[2],
        attempt_at: new Date().toISOString(),
        frozen_payload: JSON.parse(params[3]),
        retry_safe: false,
      });
    if (text.startsWith("UPDATE email_messages SET provider_id="))
      Object.assign(state.message, {
        provider_id: params[0],
        state: "accepted",
      });
    if (text.startsWith("UPDATE email_messages SET state=$"))
      Object.assign(state.message, {
        state: params[0],
        retry_safe:
          typeof params[1] === "boolean" ? params[1] : state.message.retry_safe,
      });
    if (text.startsWith("INSERT INTO email_messages"))
      Object.assign(state.message, {
        id: params[0],
        recipients: JSON.parse(params[1]),
        subject: params[2],
        html: params[3],
        plain_text: params[4],
        state: "draft",
        frozen_payload: null,
        attempt_id: null,
        retry_safe: true,
      });
    if (text.startsWith("UPDATE email_messages SET estimate_id"))
      Object.assign(state.message, {
        estimate_id: params[0],
        estimate_snapshot: JSON.parse(params[1]),
      });
    if (text.includes("COALESCE(sum(size)"))
      return { rows: [{ count: state.attachments.length, size: 0 }] };
    if (text.startsWith("INSERT INTO email_attachments"))
      state.attachments.push({
        id: params[0],
        message_id: params[1],
        name: params[2],
        pathname: params[3],
        content_type: params[4],
        size: params[5],
        estimate_id: params[6],
      });
    if (text.startsWith("INSERT INTO email_events")) {
      if (state.events.has(params[0])) return { rows: [] };
      state.events.add(params[0]);
      return { rows: [{ id: params[0] }] };
    }
    if (text.startsWith("INSERT INTO email_suppressions"))
      state.suppressed.push(params[0]);
    return { rows: [] };
  });
});
describe("email validation and safe customer PDF", () => {
  it("rejects unresolved placeholders in subject, HTML and plain text", () => {
    for (const field of ["subject", "html", "plainText"])
      expect(() =>
        validateDraft({ ...draft, [field]: "{{missing}}" }, true),
      ).toThrow(/placeholder/);
  });
  it("validates recipients and forbids campaigns/header injection", () => {
    expect(() =>
      validateDraft(
        {
          ...draft,
          recipients: {
            to: ["a@example.test", "b@example.test"],
            cc: [],
            bcc: [],
          },
        },
        true,
      ),
    ).toThrow(/one customer/);
    expect(() =>
      validateDraft({ ...draft, subject: "Hello\nBcc:x" }, true),
    ).toThrow(/single line/);
    expect(() =>
      validateDraft(
        { ...draft, recipients: { to: ["invalid"], cc: [], bcc: [] } },
        true,
      ),
    ).toThrow(/Invalid/);
  });
  it("removes scripts, tracking images, event attributes and unsafe links", () => {
    const html = cleanHtml(
      '<p onclick="alert(1)">Hello</p><script>bad()</script><img src="https://track.test"><a href="javascript:alert(1)">Link</a>',
    );
    expect(html).not.toMatch(/script|onclick|img|javascript/);
    expect(html).toContain("Hello");
  });
  it("uses saved customer pricing and excludes internal notes and margins", async () => {
    const fields = customerEstimateFields(fixture).join("\n");
    expect(fields).toContain("$222.00");
    expect(fields).toContain("Public note");
    expect(fields).not.toMatch(/PRIVATE_|internalCost|estimatedHours/);
    const pdf = await estimatePdf(fixture, "reply@example.test");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("does not regress confirmed delivery and terminal complaint state", () => {
    expect(nextDeliveryState("delivered", "email.sent")).toBe("delivered");
    expect(nextDeliveryState("complained", "email.delivered")).toBe(
      "complained",
    );
    expect(nextDeliveryState("accepted", "email.delivery_delayed")).toBe(
      "accepted",
    );
  });
});
describe("protected persistence and reliable sending", () => {
  it("saves sanitized drafts without sending", async () => {
    await saveEmailDraft({ ...draft, html: '<p>Hello</p><img src="pixel">' });
    expect(state.message.html).toBe("<p>Hello</p>");
    expect(state.send).not.toHaveBeenCalled();
  });
  it("denies draft access and sending without individual staff permission", async () => {
    state.allowed = false;
    await expect(saveEmailDraft(draft)).rejects.toThrow(/Unauthorized/);
    state.allowed = true;
    state.staff = false;
    await expect(sendEmailDraft(id)).rejects.toThrow(/Staff/);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("attributes staff and distinguishes acceptance from delivery", async () => {
    expect(await sendEmailDraft(id)).toEqual({ id, state: "accepted" });
    expect(state.message.sender_id).toBe("staff-1");
    expect(state.send.mock.calls[0][0].replyTo).toBe("reply@example.test");
    expect(state.message.state).not.toBe("delivered");
  });
  it("returns existing acceptance on duplicate sends", async () => {
    await sendEmailDraft(id);
    await sendEmailDraft(id);
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it("retries uncertain acceptance with exactly the same key and payload", async () => {
    state.send.mockRejectedValueOnce(new Error("network"));
    await expect(sendEmailDraft(id)).rejects.toThrow(/uncertain/);
    expect(state.message.state).toBe("queued");
    await expect(saveEmailDraft({ ...draft, id })).rejects.toThrow(/locked/);
    await sendEmailDraft(id);
    expect(state.send.mock.calls[1]).toEqual(state.send.mock.calls[0]);
  });
  it("keeps a definitively rejected draft recoverable", async () => {
    state.send.mockResolvedValueOnce({
      data: null,
      error: {
        statusCode: 422,
        name: "validation_error",
        message: "Invalid content",
      },
    });
    await expect(sendEmailDraft(id)).rejects.toThrow(/rejected/);
    expect(state.message.html).toBe(draft.html);
    expect(state.message.state).toBe("failed");
    await saveEmailDraft({ ...draft, id });
    expect(state.message.state).toBe("draft");
  });
  it("blocks suppressed recipients, excessive retries and expired attempts", async () => {
    state.suppressed = ["delivered@resend.dev"];
    await expect(sendEmailDraft(id)).rejects.toThrow(/suppressed/);
    state.suppressed = [];
    state.requests = 5;
    await expect(sendEmailDraft(id)).rejects.toThrow(/limit/);
    state.message.attempt_at = "2020-01-01";
    await expect(sendEmailDraft(id)).rejects.toThrow(/window/);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("freezes only customer estimate fields and never sends while generating PDF", async () => {
    vi.mocked(getEstimateById).mockResolvedValue(fixture);
    vi.mocked(put).mockResolvedValue({ pathname: "private-estimate" } as any);
    await createEstimateDraft(fixture.id);
    expect(state.attachments[0].estimate_id).toBe(fixture.id);
    expect(JSON.stringify(state.message.estimate_snapshot)).not.toMatch(
      /PRIVATE_/,
    );
    expect(state.send).not.toHaveBeenCalled();
    vi.mocked(getEstimateById).mockRejectedValue(new Error("Estimate changed"));
    state.attachments = [];
    await attachEstimate(state.message.id);
    expect(state.attachments.length).toBe(1);
  });
});
describe("private files and verified provider events", () => {
  it("verifies real Resend signatures and rejects forged signatures", () => {
    const secretBytes = Buffer.from("workspace-webhook-test-secret");
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const payload = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: "test" },
    });
    const timestamp = String(Math.floor(Date.now() / 1000)),
      eventId = "msg_test";
    const signature = `v1,${createHmac("sha256", secretBytes).update(`${eventId}.${timestamp}.${payload}`).digest("base64")}`;
    const sdk = new Resend("re_test");
    expect(
      sdk.webhooks.verify({
        payload,
        headers: { id: eventId, timestamp, signature },
        webhookSecret: secret,
      }).type,
    ).toBe("email.delivered");
    expect(() =>
      sdk.webhooks.verify({
        payload,
        headers: { id: eventId, timestamp, signature: "v1,forged" },
        webhookSecret: secret,
      }),
    ).toThrow();
  });
  it("requires a verified session whose email is explicitly approved", async () => {
    const real = await vi.importActual<any>("@/lib/email-workspace-db");
    const user = {
      id: "staff-1",
      name: "Staff",
      email: "approved@example.test",
      emailVerified: true,
    };
    expect(
      real.approvedEmailStaff({ ...user, emailVerified: false }, [
        "approved@example.test",
      ]),
    ).toBeNull();
    expect(
      real.approvedEmailStaff({ ...user, email: "unapproved@example.test" }, [
        "approved@example.test",
      ]),
    ).toBeNull();
    expect(real.approvedEmailStaff(null, ["approved@example.test"])).toBeNull();
    expect(real.approvedEmailStaff(user, ["approved@example.test"]).id).toBe(
      "staff-1",
    );
  });
  it("rejects oversized or disguised attachments", () => {
    expect(() =>
      validateAttachment("bad.pdf", "application/pdf", Buffer.from("not pdf")),
    ).toThrow(/Supported/);
    expect(() =>
      validateAttachment("large.txt", "text/plain", Buffer.alloc(3_000_001)),
    ).toThrow(/3 MB/);
  });
  it("authenticates private attachment access without exposing blob URLs", async () => {
    state.allowed = false;
    const response = await download(
      new Request(`https://app.test/api/admin/email/attachments?id=${id}`),
    );
    expect(response.status).toBe(401);
    expect(get).not.toHaveBeenCalled();
    state.allowed = true;
    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      blob: { size: 5 },
      stream: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("%PDF-"));
          c.close();
        },
      }),
    } as any);
    expect(
      (
        await attachmentBytes({
          id,
          message_id: id,
          name: "test.pdf",
          pathname: "private-file",
          content_type: "application/pdf",
          size: 5,
          estimate_id: null,
        })
      ).toString(),
    ).toBe("%PDF-");
    expect(get).toHaveBeenCalledWith("private-file", {
      token: "test-private-token",
      access: "private",
      useCache: false,
    });
  });
  it("rejects forged signatures and processes duplicate hard-bounce events once", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    state.verify.mockImplementationOnce(() => {
      throw new Error("Invalid");
    });
    const req = () =>
      new Request("https://app.test/api/webhooks/resend", {
        method: "POST",
        headers: {
          "svix-id": "event-1",
          "svix-timestamp": "123",
          "svix-signature": "forged",
        },
        body: "{}",
      });
    expect((await webhook(req())).status).toBe(401);
    expect(state.events.size).toBe(0);
    state.verify.mockReturnValue({
      type: "email.bounced",
      created_at: new Date().toISOString(),
      data: {
        email_id: "provider-test",
        to: ["delivered@resend.dev"],
        bounce: { type: "Permanent" },
      },
    });
    state.message.provider_id = "provider-test";
    expect((await webhook(req())).status).toBe(200);
    expect((await webhook(req())).status).toBe(200);
    expect(state.events.size).toBe(1);
    expect(state.suppressed).toEqual(["delivered@resend.dev"]);
    expect(state.message.state).toBe("bounced");
  });
});
