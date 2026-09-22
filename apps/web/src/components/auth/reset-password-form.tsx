"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Field, FormError, SubmitButton } from "./field";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resetPassword(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    if (newPassword !== String(formData.get("confirmPassword") ?? "")) {
      setError("The passwords do not match.");
      return;
    }

    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ token, newPassword });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/sign-in?reset=1");
    router.refresh();
  }

  return (
    <form action={resetPassword} className="flex flex-col gap-4">
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
      <FormError message={error} />
      <SubmitButton pending={pending}>Change my password</SubmitButton>
    </form>
  );
}
