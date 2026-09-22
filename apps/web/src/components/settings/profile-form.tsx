"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError, SubmitButton } from "@/components/auth/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import type { User } from "@/lib/auth/types";

export function ProfileForm({ user }: { user: Pick<User, "name" | "email"> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await authClient.updateUser({ name: String(name ?? "") });
    setPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name is shown in the header and to administrators.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Name" name="name" defaultValue={user.name} required maxLength={100} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <p id="email" className="text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
          <FormError message={error} />
          {saved && (
            <p role="status" className="text-sm text-muted-foreground">
              Profile updated.
            </p>
          )}
          <SubmitButton pending={pending}>Save</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
