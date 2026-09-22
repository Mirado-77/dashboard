"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { Field, FormError, SubmitButton } from "./field";
import { ResendVerification } from "./resend-verification";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function signIn(formData: FormData) {
    setPending(true);
    setError(null);
    const email = String(formData.get("email") ?? "");
    const { error } = await authClient.signIn.email({
      email,
      password: String(formData.get("password") ?? ""),
      rememberMe: formData.get("rememberMe") === "on",
    });
    setPending(false);

    if (!error) {
      router.replace(next);
      router.refresh();
      return;
    }
    if (error.code === "EMAIL_NOT_VERIFIED") {
      setUnverifiedEmail(email);
      setError("Confirm your email first. We sent you a new link.");
      return;
    }
    setError(error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={signIn} className="flex flex-col gap-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className="flex items-center gap-2">
          <Checkbox id="rememberMe" name="rememberMe" defaultChecked />
          <Label htmlFor="rememberMe" className="font-normal">
            Remember me
          </Label>
        </div>
        <FormError message={error} />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
        <Button variant="link" size="sm" className="h-auto self-start px-0" asChild>
          <Link href="/forgot-password">Forgot your password?</Link>
        </Button>
      </form>
      {unverifiedEmail && <ResendVerification email={unverifiedEmail} />}
      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Button variant="link" size="sm" className="h-auto px-0" asChild>
          <Link href="/sign-up">Create one</Link>
        </Button>
      </p>
    </div>
  );
}
