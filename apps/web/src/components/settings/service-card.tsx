"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/auth/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { servicesClient } from "@/lib/services/client";
import type { ServiceSummary } from "@/lib/services/types";

const PROVIDER_NOT_LINKED = "PROVIDER_NOT_LINKED";

export function ServiceCard({ service }: { service: ServiceSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLink, setNeedsLink] = useState(false);
  const fields = service.credentialFields ?? [];

  async function subscribe(credentials: Record<string, string> = {}) {
    setPending(true);
    setError(null);
    setNeedsLink(false);

    const { error } = await servicesClient.subscribe(service.id, credentials);
    setPending(false);

    if (error) {
      setError(error.message);
      setNeedsLink(error.code === PROVIDER_NOT_LINKED);
      return;
    }
    router.refresh();
  }

  async function unsubscribe() {
    setPending(true);
    setError(null);

    const { error } = await servicesClient.unsubscribe(service.id);
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const credentials = Object.fromEntries(
      fields.map((field) => [field.name, String(data.get(field.name) ?? "")]),
    );
    void subscribe(credentials);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{service.name}</CardTitle>
            <CardDescription>{service.description}</CardDescription>
          </div>
          <Badge variant={service.subscribed ? "default" : "secondary"}>
            {service.subscribed ? "Subscribed" : "Not subscribed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {service.providerType === "credentials" && !service.subscribed && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {fields.map((field) => (
              <Field
                key={field.name}
                label={field.label}
                name={field.name}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                required
              />
            ))}
            <Button type="submit" size="sm" className="self-start" disabled={pending}>
              {pending ? "Please wait…" : "Subscribe"}
            </Button>
          </form>
        )}

        {service.providerType === "credentials" && service.subscribed && (
          <p className="text-sm text-muted-foreground">
            {service.hasCredentials
              ? "Your credentials are stored, encrypted. Unsubscribe to remove them."
              : "No credentials stored for this service."}
          </p>
        )}

        {service.providerType === "oauth" && !service.subscribed && (
          <p className="text-sm text-muted-foreground">
            This service uses your linked {service.name} account.
          </p>
        )}

        {needsLink && (
          <Button variant="outline" size="sm" className="self-start" asChild>
            <Link href="/settings/accounts">Link my {service.name} account</Link>
          </Button>
        )}

        <FormError message={error} />

        {service.subscribed ? (
          <Button variant="outline" size="sm" className="self-start" onClick={unsubscribe} disabled={pending}>
            {pending ? "Please wait…" : "Unsubscribe"}
          </Button>
        ) : (
          service.providerType !== "credentials" && (
            <Button size="sm" className="self-start" onClick={() => subscribe()} disabled={pending}>
              {pending ? "Please wait…" : "Subscribe"}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
