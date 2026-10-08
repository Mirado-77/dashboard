"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/auth/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { servicesClient } from "@/lib/services/client";
import type { ServiceSummary } from "@/lib/services/types";

const PROVIDER_NOT_LINKED = "PROVIDER_NOT_LINKED";
const PROVIDER_SCOPE_MISSING = "PROVIDER_SCOPE_MISSING";
const SERVICES_PAGE = "/settings/services";

function statusOf(service: ServiceSummary): { label: string; active: boolean } {
  if (service.providerType === "none") return { label: "Available by default", active: true };
  return service.subscribed
    ? { label: "Subscribed", active: true }
    : { label: "Not subscribed", active: false };
}

export function ServiceCard({
  service,
  autoSubscribe = false,
}: {
  service: ServiceSummary;
  /** Back from the provider, where the user granted access: finish the subscription. */
  autoSubscribe?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLink, setNeedsLink] = useState(false);
  const autoSubscribed = useRef(false);
  const fields = service.credentialFields ?? [];
  const status = statusOf(service);

  async function subscribe(credentials: Record<string, string> = {}) {
    setPending(true);
    setError(null);
    setNeedsLink(false);

    const { error } = await servicesClient.subscribe(service.id, credentials);
    setPending(false);

    if (error) {
      setError(error.message);
      setNeedsLink(error.code === PROVIDER_NOT_LINKED || error.code === PROVIDER_SCOPE_MISSING);
      return;
    }
    router.refresh();
  }

  async function grantAccess() {
    setPending(true);
    setError(null);
    const { error } = await authClient.linkSocial({
      provider: service.oauthProviderId,
      scopes: service.oauthScopes,
      callbackURL: `${SERVICES_PAGE}?subscribe=${encodeURIComponent(service.id)}`,
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
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

  useEffect(() => {
    if (!autoSubscribe || autoSubscribed.current) return;
    autoSubscribed.current = true;
    // Drops `?subscribe=` so that a reload does not subscribe again.
    router.replace(SERVICES_PAGE);
    if (service.subscribed || !service.accessGranted) return;

    void servicesClient.subscribe(service.id).then(({ error }) => {
      if (error) {
        setError(error.message);
        return;
      }
      router.refresh();
    });
  }, [autoSubscribe, router, service.id, service.subscribed, service.accessGranted]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const credentials = Object.fromEntries(
      fields.map((field) => [field.name, String(data.get(field.name) ?? "")]),
    );
    void subscribe(credentials);
  }

  const canGrant =
    service.providerType === "oauth" && !service.subscribed && (!service.accessGranted || needsLink);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{service.name}</CardTitle>
            <CardDescription>{service.description}</CardDescription>
          </div>
          <Badge variant={status.active ? "default" : "secondary"}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {service.providerType === "none" && (
          <p className="text-sm text-muted-foreground">
            No account needed: its widgets are already available on your dashboard.
          </p>
        )}

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

        {canGrant && (
          <p className="text-sm text-muted-foreground">
            This service reads your data from your linked account. Allow it first, then you will be
            subscribed.
          </p>
        )}

        <FormError message={error} />

        {canGrant && (
          <Button size="sm" className="self-start" onClick={grantAccess} disabled={pending}>
            {pending ? "Please wait…" : `Allow access to ${service.name}`}
          </Button>
        )}

        {service.providerType === "oauth" && !service.subscribed && !canGrant && (
          <Button size="sm" className="self-start" onClick={() => subscribe()} disabled={pending}>
            {pending ? "Please wait…" : "Subscribe"}
          </Button>
        )}

        {service.providerType !== "none" && service.subscribed && (
          <Button variant="outline" size="sm" className="self-start" onClick={unsubscribe} disabled={pending}>
            {pending ? "Please wait…" : "Unsubscribe"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
