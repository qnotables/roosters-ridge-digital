import { describe, expect, it } from "vitest";
import { confirmEmailStaffSession } from "@/lib/email-workspace-types";

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
