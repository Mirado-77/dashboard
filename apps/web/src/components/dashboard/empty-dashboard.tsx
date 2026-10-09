"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import type { ServiceSummary } from "@/lib/services/types";
import { suggestions } from "@/lib/widgets/catalog";
import { widgetsClient } from "@/lib/widgets/client";
import type { WidgetInstance } from "@/lib/widgets/types";
import { WidgetPreview } from "./add-widget/widget-preview";

export function EmptyDashboard({
  services,
  onAdded,
  onBrowse,
}: {
  services: ServiceSummary[];
  onAdded: (widget: WidgetInstance) => void;
  onBrowse: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = suggestions.flatMap((suggestion) => {
    const service = services.find((candidate) => candidate.id === suggestion.serviceId);
    const widget = service?.widgets.find((candidate) => candidate.id === suggestion.widgetId);
    return service?.available && widget ? [{ suggestion, service, widget }] : [];
  });

  async function add(key: string, serviceId: string, widgetId: string, config: Record<string, string | number>, refreshRate: number) {
    setPending(key);
    setError(null);
    const { data, error } = await widgetsClient.create({ serviceId, widgetId, config, refreshRate });
    setPending(null);
    if (error) {
      setError(error.message);
      return;
    }
    onAdded(data);
  }

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-dashed p-6" aria-labelledby="empty-dashboard">
      <div className="flex flex-col gap-1">
        <h2 id="empty-dashboard" className="text-lg font-semibold">
          Your dashboard is empty
        </h2>
        <p className="text-sm text-muted-foreground">
          Start with one of these widgets, or browse them all. You can change their settings later.
        </p>
      </div>

      <FormError message={error} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ready.map(({ suggestion, service, widget }) => {
          const key = `${service.id}/${widget.id}`;
          return (
            <div key={key} className="flex flex-col gap-3">
              <WidgetPreview
                serviceId={service.id}
                widgetId={widget.id}
                name={suggestion.label}
                serviceName={service.name}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() =>
                  add(key, service.id, widget.id, suggestion.config, widget.defaultRefreshRate)
                }
                disabled={pending !== null}
              >
                <Plus aria-hidden />
                {pending === key ? "Adding…" : `Add ${suggestion.label}`}
              </Button>
            </div>
          );
        })}
      </div>

      <Button className="self-start" onClick={onBrowse}>
        Browse all widgets
      </Button>
    </section>
  );
}
