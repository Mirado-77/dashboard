"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ServiceSummary, WidgetSummary } from "@/lib/services/types";
import { widgetsClient } from "@/lib/widgets/client";
import type { WidgetConfig, WidgetInstance } from "@/lib/widgets/types";
import { WidgetForm } from "./widget-form";

interface Choice {
  service: ServiceSummary;
  widget: WidgetSummary;
}

export function AddWidgetDialog({
  services,
  onAdded,
}: {
  services: ServiceSummary[];
  onAdded: (widget: WidgetInstance) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscribed = services.filter((service) => service.subscribed && service.widgets.length > 0);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setChoice(null);
      setError(null);
    }
  }

  async function add(config: WidgetConfig, refreshRate: number) {
    if (!choice) return;
    setPending(true);
    setError(null);

    const { data, error } = await widgetsClient.create({
      serviceId: choice.service.id,
      widgetId: choice.widget.id,
      config,
      refreshRate,
    });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    onAdded(data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden />
          Add widget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {choice === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Add a widget</DialogTitle>
              <DialogDescription>Choose the type of widget.</DialogDescription>
            </DialogHeader>
            {subscribed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Subscribe to a service first on the{" "}
                <Link href="/settings/services" className="underline underline-offset-4">
                  Services
                </Link>{" "}
                page.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {subscribed.map((service) => (
                  <section key={service.id} className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">{service.name}</h3>
                    {service.widgets.map((widget) => (
                      <button
                        key={widget.id}
                        type="button"
                        onClick={() => setChoice({ service, widget })}
                        className="flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <span className="text-sm font-medium">{widget.name}</span>
                        <span className="text-xs text-muted-foreground">{widget.description}</span>
                      </button>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{choice.widget.name}</DialogTitle>
              <DialogDescription>
                {choice.service.name} · {choice.widget.description}
              </DialogDescription>
            </DialogHeader>
            <WidgetForm widget={choice.widget} error={error} onSubmit={add}>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChoice(null);
                    setError(null);
                  }}
                  disabled={pending}
                >
                  Back
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Please wait…" : "Add to dashboard"}
                </Button>
              </DialogFooter>
            </WidgetForm>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
