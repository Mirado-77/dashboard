"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useEffect, useRef, useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/auth/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { servicesClient } from "@/lib/services/client";
import type { ServiceSummary } from "@/lib/services/types";
import { cn } from "@/lib/utils";
import { serviceIcon } from "@/lib/widgets/catalog";

const PROVIDER_NOT_LINKED = "PROVIDER_NOT_LINKED";
const PROVIDER_SCOPE_MISSING = "PROVIDER_SCOPE_MISSING";
const SERVICES_PAGE = "/settings/services";

function addWidgetHref(serviceId: string, widgetId: string): string {
  return `/dashboard?add=${encodeURIComponent(`${serviceId}/${widgetId}`)}`;
}

function providerName(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function Status({ service }: { service: ServiceSummary }) {
  const ready = service.available;
  const label =
    service.providerType === "none" ? "Ready" : service.subscribed ? "Connected" : "Not connected";

  return (
    <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
      <span
        className={cn("size-1.5 rounded-full", ready ? "bg-emerald-500" : "bg-muted-foreground/50")}
        aria-hidden
      />
      {label}
    </Badge>
  );
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
  const firstWidget = service.widgets[0];

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

  const needsGrant =
    service.providerType === "oauth" && !service.subscribed && (!service.accessGranted || needsLink);

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {createElement(serviceIcon(service.id), { className: "size-5", "aria-hidden": true })}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>{service.name}</CardTitle>
          <CardDescription>{service.description}</CardDescription>
        </div>
        <Status service={service} />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {service.widgets.length} {service.widgets.length === 1 ? "widget" : "widgets"}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {service.widgets.map((widget) => (
              <li key={widget.id}>
                {service.available ? (
                  <Link
                    href={addWidgetHref(service.id, widget.id)}
                    title={widget.description}
                    className="inline-flex rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {widget.name}
                  </Link>
                ) : (
                  <span
                    title={widget.description}
                    className="inline-flex rounded-md border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {widget.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {service.providerType === "credentials" && !service.subscribed && (
          <form id={`credentials-${service.id}`} onSubmit={onSubmit} className="flex flex-col gap-4">
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
          </form>
        )}

        {needsGrant && (
          <p className="text-sm text-muted-foreground">
            Uses your {providerName(service.oauthProviderId)} account, read-only. You will allow it on the
            provider&apos;s page, then come back here.
          </p>
        )}

        <FormError message={error} />
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {service.available && firstWidget && (
          <Button size="sm" asChild>
            <Link href={addWidgetHref(service.id, firstWidget.id)}>
              <Plus aria-hidden />
              Add a widget
            </Link>
          </Button>
        )}

        {needsGrant && (
          <Button size="sm" onClick={grantAccess} disabled={pending}>
            {pending ? "Please wait…" : "Connect"}
          </Button>
        )}

        {service.providerType === "oauth" && !service.subscribed && !needsGrant && (
          <Button size="sm" onClick={() => subscribe()} disabled={pending}>
            {pending ? "Please wait…" : "Connect"}
          </Button>
        )}

        {service.providerType === "credentials" && !service.subscribed && (
          <Button type="submit" form={`credentials-${service.id}`} size="sm" disabled={pending}>
            {pending ? "Please wait…" : "Connect"}
          </Button>
        )}

        {service.providerType !== "none" && service.subscribed && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={unsubscribe} disabled={pending}>
            {pending ? "Please wait…" : "Disconnect"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
