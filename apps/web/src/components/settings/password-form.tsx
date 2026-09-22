"use client";

import { useState, type FormEvent } from "react";
import { Field, FormError, SubmitButton } from "@/components/auth/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmPassword") ?? "");

    setChanged(false);
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: data.get("revokeOtherSessions") !== null,
    });
    setPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    form.reset();
    setChanged(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Changing your password can also sign you out everywhere else.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
          <Field
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          <Field
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          <div className="flex items-center gap-2">
            <Checkbox id="revokeOtherSessions" name="revokeOtherSessions" defaultChecked />
            <Label htmlFor="revokeOtherSessions" className="font-normal">
              Sign out my other devices
            </Label>
          </div>
          <FormError message={error} />
          {changed && (
            <p role="status" className="text-sm text-muted-foreground">
              Password changed.
            </p>
          )}
          <SubmitButton pending={pending}>Change password</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
