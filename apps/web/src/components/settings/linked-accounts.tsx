"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth/client";
import type { LinkedAccount, Provider } from "@/lib/auth/types";

export function LinkedAccounts({
  providers,
  accounts,
}: {
  providers: Provider[];
  accounts: LinkedAccount[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect(providerId: string) {
    setPending(providerId);
    setError(null);
    const { error } = await authClient.linkSocial({
      provider: providerId,
      callbackURL: "/settings/accounts",
    });
    if (error) {
      setError(error.message);
      setPending(null);
    }
  }

  async function disconnect(providerId: string) {
    setPending(providerId);
    setError(null);
    const { error } = await authClient.unlinkAccount({ providerId });
    if (error) setError(error.message);
    router.refresh();
    setPending(null);
  }

  if (providers.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground">
          No provider is configured on the server.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="py-0">
        <CardContent className="px-0">
          {providers.map((provider, index) => {
            const account = accounts.find((a) => a.providerId === provider.id);
            return (
              <div key={provider.id}>
                {index > 0 && <Separator />}
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{provider.name}</p>
                      <Badge variant={account ? "default" : "secondary"}>
                        {account ? "Connected" : "Not connected"}
                      </Badge>
                    </div>
                    {account && account.scopes.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {account.scopes.join(", ")}
                      </p>
                    )}
                  </div>
                  <Button
                    variant={account ? "outline" : "default"}
                    size="sm"
                    onClick={() => (account ? disconnect(provider.id) : connect(provider.id))}
                    disabled={pending !== null}
                  >
                    {account ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <FormError message={error} />
    </div>
  );
}
