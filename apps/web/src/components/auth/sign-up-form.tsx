"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { Field, FormError, SubmitButton } from "./field";
import { ResendVerification } from "./resend-verification";

export function SignUpForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function signUp(formData: FormData) {
    setPending(true);
    setError(null);
    const email = String(formData.get("email") ?? "");
    const { error } = await authClient.signUp.email({
      name: String(formData.get("name") ?? ""),
      email,
      password: String(formData.get("password") ?? ""),
      callbackURL: "/verify-email",
    });
    setPending(false);
    if (error) setError(error.message);
    else setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to activate your
          account.
        </p>
        <ResendVerification email={sentTo} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={signUp} className="flex flex-col gap-4">
        <Field label="Name" name="name" autoComplete="name" required maxLength={100} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
      <p className="text-sm text-muted-foreground">
        Already registered?{" "}
        <Button variant="link" size="sm" className="h-auto px-0" asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </p>
    </div>
  );
}
