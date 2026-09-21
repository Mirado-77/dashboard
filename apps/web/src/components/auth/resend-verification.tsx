"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

export function ResendVerification({ email }: { email?: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");

  async function resend(formData: FormData) {
    setStatus("pending");
    const { error } = await authClient.sendVerificationEmail({
      email: String(formData.get("email") ?? ""),
      callbackURL: "/verify-email",
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <form action={resend} className="flex flex-col gap-2">
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Input type="email" name="email" required aria-label="Email" placeholder="you@example.com" />
      )}
      <Button
        type="submit"
        variant="link"
        size="sm"
        disabled={status === "pending"}
        className="self-start px-0"
      >
        Resend the confirmation email
      </Button>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {status === "sent" && "If this account needs it, a new email is on its way."}
        {status === "error" && "Could not send the email, try again later."}
      </p>
    </form>
  );
}
