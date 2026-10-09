"use client";

import { LayoutGrid } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { servicesClient } from "@/lib/services/client";
import type { ServiceSummary } from "@/lib/services/types";
import type { WidgetInstance } from "@/lib/widgets/types";
import { WidgetCatalog } from "./widget-catalog";
import { WidgetConfigurator } from "./widget-configurator";

/** `?add=catalog` opens the panel, `?add=weather/forecast` opens it on that widget. */
export const ADD_PARAM = "add";
const CATALOG = "catalog";

export function openAddPanel(selection: string = CATALOG) {
  window.history.pushState(null, "", `?${ADD_PARAM}=${encodeURIComponent(selection)}`);
}

function find(services: ServiceSummary[], selection: string | null) {
  if (!selection) return null;
  const [serviceId, widgetId] = selection.split("/");
  const service = services.find((candidate) => candidate.id === serviceId);
  const widget = service?.widgets.find((candidate) => candidate.id === widgetId);
  return service && widget ? { service, widget } : null;
}

/** Back from the provider: finish the subscription the user just allowed. */
function useFinishConnection(services: ServiceSummary[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const connectId = searchParams.get("connect");
  const done = useRef(false);

  useEffect(() => {
    if (!connectId || done.current) return;
    done.current = true;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("connect");
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);

    const service = services.find((candidate) => candidate.id === connectId);
    if (!service || service.available || !service.accessGranted) return;
    void servicesClient.subscribe(service.id).then(({ error }) => {
      if (!error) router.refresh();
    });
  }, [connectId, pathname, router, searchParams, services]);
}

export function AddWidgetPanel({
  services,
  onAdded,
}: {
  services: ServiceSummary[];
  onAdded: (widget: WidgetInstance) => void;
}) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useFinishConnection(services);

  const param = searchParams.get(ADD_PARAM);
  const open = param !== null;
  const chosen = find(services, param === CATALOG ? null : param);
  const selection = chosen ? `${chosen.service.id}/${chosen.widget.id}` : null;

  function select(next: string) {
    window.history.replaceState(null, "", `?${ADD_PARAM}=${encodeURIComponent(next)}`);
  }

  function close() {
    window.history.replaceState(null, "", pathname);
  }

  function added(widget: WidgetInstance) {
    onAdded(widget);
    close();
  }

  const title = "Add a widget";
  const description = "Pick a widget, check its preview, then set it up.";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(next) => !next && close()}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{chosen ? chosen.widget.name : title}</DrawerTitle>
            <DrawerDescription>{chosen ? chosen.widget.description : description}</DrawerDescription>
          </DrawerHeader>
          {chosen ? (
            <div className="overflow-y-auto px-4 pb-6">
              <WidgetConfigurator
                service={chosen.service}
                widget={chosen.widget}
                onBack={() => select(CATALOG)}
                onAdded={added}
              />
            </div>
          ) : (
            <WidgetCatalog services={services} selection={selection} onSelect={select} />
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="w-full gap-0 sm:max-w-4xl">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-80 shrink-0 flex-col border-r pt-4">
            <WidgetCatalog services={services} selection={selection} onSelect={select} />
          </aside>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {chosen ? (
              <WidgetConfigurator service={chosen.service} widget={chosen.widget} onAdded={added} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <LayoutGrid className="size-8" aria-hidden />
                <p className="text-sm">Choose a widget on the left to see its preview.</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
