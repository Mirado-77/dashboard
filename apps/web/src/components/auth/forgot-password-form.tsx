"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { Field, FormError, SubmitButton } from "./field";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function requestReset(formData: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: String(formData.get("email") ?? ""),
      callbackURL: "/reset-password",
    });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">
          If an account uses this address, a reset link is on its way. The link expires in one
          hour.
        </p>
        <Button variant="link" size="sm" className="h-auto self-start px-0" asChild>
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={requestReset} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <FormError message={error} />
      <SubmitButton pending={pending}>Send the reset link</SubmitButton>
      <Button variant="link" size="sm" className="h-auto self-start px-0" asChild>
        <Link href="/sign-in">Back to sign in</Link>
      </Button>
    </form>
  );
}
