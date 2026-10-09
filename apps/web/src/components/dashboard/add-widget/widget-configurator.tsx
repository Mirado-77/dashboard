"use client";

import { ArrowLeft, Plug } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormError } from "@/components/auth/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ServiceSummary, WidgetSummary } from "@/lib/services/types";
import { widgetsClient } from "@/lib/widgets/client";
import type { WidgetConfig, WidgetInstance } from "@/lib/widgets/types";
import { WidgetForm } from "../widget-form";
import { useConnectService } from "./use-connect-service";
import { WidgetPreview } from "./widget-preview";

function ConnectCallout({ service, selection }: { service: ServiceSummary; selection: string }) {
  const { connect, pending, error } = useConnectService(service, selection);

  return (
    <Alert>
      <Plug aria-hidden />
      <AlertTitle>Connect {service.name} to add this widget</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        {service.providerType === "credentials" ? (
          <>
            This service needs your credentials.
            <Button size="sm" asChild>
              <Link href="/settings/services">Set up {service.name}</Link>
            </Button>
          </>
        ) : (
          <>
            {service.accessGranted
              ? "Your account is ready, one click to use it."
              : "You will allow access on the provider's page, then come back here."}
            <Button size="sm" onClick={connect} disabled={pending}>
              {pending ? "Connecting…" : `Connect ${service.name}`}
            </Button>
          </>
        )}
        <FormError message={error} />
      </AlertDescription>
    </Alert>
  );
}

export function WidgetConfigurator({
  service,
  widget,
  onBack,
  onAdded,
}: {
  service: ServiceSummary;
  widget: WidgetSummary;
  /** Back to the catalog, on small screens where both do not fit side by side. */
  onBack?: () => void;
  onAdded: (widget: WidgetInstance) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selection = `${service.id}/${widget.id}`;

  async function add(config: WidgetConfig, refreshRate: number) {
    setPending(true);
    setError(null);

    const { data, error } = await widgetsClient.create({
      serviceId: service.id,
      widgetId: widget.id,
      config,
      refreshRate,
    });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    onAdded(data);
  }

  return (
    <div className="flex flex-col gap-5">
      {onBack && (
        <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={onBack}>
          <ArrowLeft aria-hidden />
          All widgets
        </Button>
      )}

      <WidgetPreview
        serviceId={service.id}
        widgetId={widget.id}
        name={widget.name}
        serviceName={service.name}
      />

      {service.available ? (
        // A new key per widget resets the uncontrolled form when the choice changes.
        <WidgetForm key={selection} widget={widget} error={error} onSubmit={add}>
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Please wait…" : "Add to dashboard"}
          </Button>
        </WidgetForm>
      ) : (
        <ConnectCallout service={service} selection={selection} />
      )}
    </div>
  );
}
