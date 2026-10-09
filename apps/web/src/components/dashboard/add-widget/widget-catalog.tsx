"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ServiceSummary } from "@/lib/services/types";
import { catalogEntry } from "@/lib/widgets/catalog";
import { cn } from "@/lib/utils";
import { useConnectService } from "./use-connect-service";

function matches(service: ServiceSummary, text: string, query: string): boolean {
  const haystack = `${service.name} ${text}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

function ConnectButton({ service, selection }: { service: ServiceSummary; selection: string | null }) {
  const { connect, pending } = useConnectService(service, selection);

  if (service.providerType === "credentials") {
    return (
      <Button variant="link" size="xs" className="h-auto p-0" asChild>
        <Link href="/settings/services">Set up</Link>
      </Button>
    );
  }
  return (
    <Button variant="link" size="xs" className="h-auto p-0" onClick={connect} disabled={pending}>
      {pending ? "Connecting…" : "Connect"}
    </Button>
  );
}

export function WidgetCatalog({
  services,
  selection,
  onSelect,
}: {
  services: ServiceSummary[];
  /** `service/widget`, or null when nothing is chosen yet. */
  selection: string | null;
  onSelect: (selection: string) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = services
    .map((service) => ({
      service,
      widgets: service.widgets.filter((widget) =>
        matches(service, `${widget.name} ${widget.description}`, query.trim()),
      ),
    }))
    .filter((group) => group.widgets.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative px-4">
        <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a widget or a service"
          aria-label="Search a widget or a service"
          className="pl-9"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {groups.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No widget matches “{query}”.</p>
        )}
        {groups.map(({ service, widgets }) => (
          <section key={service.id} className="flex flex-col gap-1.5" aria-label={service.name}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {service.name}
              </h3>
              {!service.available && <ConnectButton service={service} selection={selection} />}
            </div>
            {widgets.map((widget) => {
              const key = `${service.id}/${widget.id}`;
              const Icon = catalogEntry(service.id, widget.id).icon;
              const active = key === selection;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-2.5 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active && "border-primary bg-accent",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {widget.name}
                      {!service.available && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          Connect first
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{widget.description}</span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
