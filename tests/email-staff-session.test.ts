import { describe, expect, it } from "vitest";
import { confirmEmailStaffSession, emailSettingsAccessBlocker } from "@/lib/email-workspace-types";

const administrator = "rooster@example.test";
const verifiedAccount = { name: "Administrator", email: administrator, emailVerified: true, approved: true };

describe("email settings access explanation", () => {
  it("preserves initial dashboard setup", () => {
    expect(emailSettingsAccessBlocker(undefined, null)).toBe("");
  });
  it("explains a missing staff session", () => {
    expect(emailSettingsAccessBlocker(administrator, null)).toContain("No staff session is signed in");
  });
  it("identifies the current account and saved administrator", () => {
    const blocker = emailSettingsAccessBlocker(administrator, { ...verifiedAccount, email: "contact@example.test" });
    expect(blocker).toContain("Signed in as contact@example.test");
    expect(blocker).toContain(administrator);
  });
  it("requires verification for the administrator", () => {
    expect(emailSettingsAccessBlocker(administrator, { ...verifiedAccount, emailVerified: false })).toContain("email is not verified");
  });
  it("does not allow an unapproved account to save", () => {
    expect(emailSettingsAccessBlocker(administrator, { ...verifiedAccount, approved: false })).toContain("not approved");
  });
  it("allows a verified approved administrator case-insensitively", () => {
    expect(emailSettingsAccessBlocker(administrator.toUpperCase(), verifiedAccount)).toBe("");
  });
});

describe("email workspace staff session confirmation", () => {
  it.each([undefined, null, {}, { staff: null, staffAccount: null }])(
    "rejects an unconfirmed workspace session: %j",
    (workspace) => {
      expect(() => confirmEmailStaffSession(workspace, "staff@example.test"))
        .toThrow("The email workspace could not confirm your staff session");
    },
  );

  it("rejects a different authenticated account", () => {
    expect(() => confirmEmailStaffSession(
      { staffAccount: { email: "other@example.test" } },
      "staff@example.test",
    )).toThrow("different staff account");
  });

  it("accepts the server-confirmed account with normalized email", () => {
    expect(() => confirmEmailStaffSession(
      { staffAccount: { email: "Staff@example.test", emailVerified: true, approved: true } },
      " STAFF@example.test ",
    )).not.toThrow();
  });

  it("keeps authentication separate from verification and approval", () => {
    expect(() => confirmEmailStaffSession(
      { staff: null, staffAccount: { email: "staff@example.test", emailVerified: false, approved: false } },
      "staff@example.test",
    )).not.toThrow();
  });
});
