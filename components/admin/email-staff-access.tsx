"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
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
}: {
  refresh: () => Promise<unknown>;
  staff: { name: string; email: string } | null;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [otp, setOtp] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(
    task: () => Promise<{ error?: { message?: string } | null }>,
    success: string,
  ) {
    setBusy(true);
    try {
      const result = await task();
      if (result.error) throw new Error(result.error.message);
      toast.success(success);
      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Staff authentication failed",
      );
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
      <CardContent>
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
                      ? authClient.signIn.email({ email, password })
                      : authClient.signUp.email({ email, password, name }),
                  mode === "signin"
                    ? "Account signed in. Verified approved accounts can send."
                    : "Account created. Verify your email and ask the dashboard administrator to approve it.",
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
                          email,
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
                      () => authClient.emailOtp.verifyEmail({ email, otp }),
                      "Email verified",
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
