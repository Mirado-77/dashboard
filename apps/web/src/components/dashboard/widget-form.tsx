"use client";

import type { FormEvent, ReactNode } from "react";
import { Field, FormError } from "@/components/auth/field";
import type { WidgetSummary } from "@/lib/services/types";
import type { WidgetConfig } from "@/lib/widgets/types";

const MAX_REFRESH_RATE = 24 * 60 * 60;

function labelOf(name: string): string {
  const words = name.replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Builds the configuration from the form. An empty optional field is left
 * out so that the API fills in its default value.
 */
function readConfig(widget: WidgetSummary, data: FormData): WidgetConfig {
  const config: WidgetConfig = {};
  for (const param of widget.params) {
    const raw = String(data.get(`param-${param.name}`) ?? "").trim();
    if (raw === "") continue;
    config[param.name] = param.type === "integer" ? Number(raw) : raw;
  }
  return config;
}

export function WidgetForm({
  widget,
  config,
  refreshRate,
  error,
  onSubmit,
  children,
}: {
  widget: WidgetSummary;
  config?: WidgetConfig;
  refreshRate?: number;
  error: string | null;
  onSubmit: (config: WidgetConfig, refreshRate: number) => void;
  /** The buttons of the form. */
  children: ReactNode;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit(readConfig(widget, data), Number(data.get("refreshRate")));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {widget.params.map((param) => (
        <Field
          key={param.name}
          label={param.required ? labelOf(param.name) : `${labelOf(param.name)} (optional)`}
          name={`param-${param.name}`}
          type={param.type === "integer" ? "number" : "text"}
          step={param.type === "integer" ? 1 : undefined}
          maxLength={param.type === "string" ? 500 : undefined}
          defaultValue={config?.[param.name] ?? param.defaultValue ?? ""}
          required={param.required}
          autoComplete="off"
        />
      ))}
      <Field
        label="Refresh every (seconds)"
        name="refreshRate"
        type="number"
        step={1}
        min={widget.minRefreshRate}
        max={MAX_REFRESH_RATE}
        defaultValue={refreshRate ?? widget.defaultRefreshRate}
        required
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        At least {widget.minRefreshRate} seconds for this widget.
      </p>
      <FormError message={error} />
      {children}
    </form>
  );
}
