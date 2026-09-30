"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { confirmEmailStaffSession, type WorkspaceData } from "@/lib/email-workspace-types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export function EmailStaffAccess({
  refresh,
  staff,
  staffAccount,
  administratorEmail,
}: {
  refresh: () => Promise<unknown>;
  staff: { name: string; email: string } | null;
  staffAccount: WorkspaceData["staffAccount"];
  administratorEmail?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [feedback, setFeedback] = useState("");
  const [email, setEmail] = useState(staffAccount?.email || administratorEmail || ""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [otp, setOtp] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(
    task: () => Promise<{ error?: { message?: string } | null }>,
    success: string,
    requireSession = false,
  ) {
    setBusy(true);
    setFeedback("");
    try {
      const result = await task();
      if (result.error) throw new Error(result.error.message || "Staff authentication failed");
      const workspace = await refresh();
      if (requireSession) {
        confirmEmailStaffSession(workspace, email);
        setPassword("");
        setOtp("");
      }
      setFeedback(success);
      toast.success(success);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Staff authentication failed";
      setFeedback(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Individual staff access</CardTitle>
        <CardDescription>
          Every send is attributed to the authenticated staff member. Account
          registration alone does not grant email permission.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {feedback && <p role="status" className="break-words text-sm">{feedback}</p>}
        {!staff && <Alert>
          <AlertTitle>{staffAccount ? "Staff account signed in" : "No staff account signed in"}</AlertTitle>
          <AlertDescription>
            {staffAccount
              ? `${staffAccount.email} · ${staffAccount.emailVerified ? "Email verified" : "Email needs verification"} · ${staffAccount.approved ? "Approved for email" : "Not on the approved staff list"}.`
              : "Email verification does not sign you in. Use your staff email and account password below; the dashboard key is not your staff password."}
            {administratorEmail && ` To save sender settings, sign in as ${administratorEmail}.`}
          </AlertDescription>
        </Alert>}
        {staff ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Signed in as <strong>{staff.name}</strong> · {staff.email}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                run(() => authClient.signOut(), "Staff signed out")
              }
              disabled={busy}
            >
              Sign out staff account
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    mode === "signin"
                      ? authClient.signIn.email({ email: email.trim().toLowerCase(), password })
                      : authClient.signUp.email({ email: email.trim().toLowerCase(), password, name }),
                  mode === "signin"
                    ? "Staff session confirmed. Verified approved accounts can send once a sender address is saved."
                    : "Account created. Verify your email and ask the dashboard administrator to approve it.",
                  mode === "signin",
                );
              }}
            >
              <FieldGroup>
                {mode === "signup" && (
                  <Field>
                    <FieldLabel htmlFor="staff-name">Staff name</FieldLabel>
                    <Input
                      id="staff-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="staff-email">Staff email</FieldLabel>
                  <Input
                    id="staff-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="staff-password">Password</FieldLabel>
                  <Input
                    id="staff-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "signin"
                      ? "Sign in staff account"
                      : "Create staff account"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    setMode(mode === "signin" ? "signup" : "signin")
                  }
                >
                  {mode === "signin"
                    ? "Create an individual staff account"
                    : "Already have an account? Sign in"}
                </Button>
              </FieldGroup>
            </form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="staff-otp">
                  Email verification code
                </FieldLabel>
                <Input
                  id="staff-otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy || !email}
                  onClick={() =>
                    run(
                      () =>
                        authClient.emailOtp.sendVerificationOtp({
                          email: email.trim().toLowerCase(),
                          type: "email-verification",
                        }),
                      "Verification code sent to your staff email",
                    )
                  }
                >
                  Send verification code
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !email || !otp}
                  onClick={() =>
                    run(
                      async () => {
                        const normalizedEmail = email.trim().toLowerCase();
                        const result = await authClient.emailOtp.verifyEmail({ email: normalizedEmail, otp: otp.trim() });
                        if (result.error || !password) return result;
                        return authClient.signIn.email({ email: normalizedEmail, password });
                      },
                      password ? "Email verified and staff session confirmed. Save your sender address to finish setup." : "Email verified. Enter your staff password and click Sign in staff account to start your session.",
                      Boolean(password),
                    )
                  }
                >
                  Verify email
                </Button>
              </div>
            </FieldGroup>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(() => authClient.signOut(), "Staff session cleared")
              }
            >
              Sign out current staff session
            </Button>
            <p className="text-sm text-muted-foreground">
              If you are signed in but cannot send, verify your email and ask
              the dashboard administrator to add your exact address in Email
              settings.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
