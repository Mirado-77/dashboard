"use client";

import { useState } from "react";
import { FormError } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth/client";
import type { Provider } from "@/lib/auth/types";

export function SocialButtons({ providers, next }: { providers: Provider[]; next: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = providers.filter((p) => p.signIn);
  if (available.length === 0) return null;

  async function signIn(provider: string) {
    setPending(provider);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: next,
      errorCallbackURL: "/sign-in",
    });
    // On success the browser is already leaving the page.
    if (error) {
      setError(error.message);
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {available.map((provider) => (
        <Button
          key={provider.id}
          variant="outline"
          onClick={() => signIn(provider.id)}
          disabled={pending !== null}
        >
          {pending === provider.id ? "Redirecting…" : `Continue with ${provider.name}`}
        </Button>
      ))}
      <FormError message={error} />
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}
