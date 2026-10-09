"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import { GripVertical, Plus, type LucideIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { FormError } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import type { ServiceSummary, WidgetSummary } from "@/lib/services/types";
import { catalogEntry } from "@/lib/widgets/catalog";
import { widgetsClient } from "@/lib/widgets/client";
import type { WidgetInstance } from "@/lib/widgets/types";
import { cn } from "@/lib/utils";
import { AddWidgetPanel, openAddPanel } from "./add-widget/add-widget-panel";
import { EmptyDashboard } from "./empty-dashboard";
import { WidgetCard } from "./widget-card";

/** Moves the item at `from` to `to`, shifting the ones in between, like the API does. */
function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** What follows the pointer: the card's frame, without its data. */
function DraggedCard({ name, serviceName, icon: Icon }: { name: string; serviceName: string; icon: LucideIcon }) {
  return (
    <div className="flex h-full w-full cursor-grabbing flex-col gap-3 rounded-xl border bg-card p-6 shadow-2xl ring-1 ring-primary/40">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-none">{name}</p>
          <p className="mt-1.5 truncate text-sm text-muted-foreground">{serviceName}</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center rounded-lg bg-muted/50">
        <Icon className="size-8 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
}

/** Dropping a widget on the add tile sends it to the end of the dashboard. */
const END = "end";

function AddTile() {
  const { setNodeRef, isOver } = useDroppable({ id: END });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => openAddPanel()}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        isOver && "border-primary bg-accent text-accent-foreground",
      )}
    >
      <Plus className="size-5" aria-hidden />
      {isOver ? "Move to the end" : "Add widget"}
    </button>
  );
}

export function Dashboard({
  services,
  initialWidgets,
}: {
  services: ServiceSummary[];
  initialWidgets: WidgetInstance[];
}) {
  const [widgets, setWidgets] = useState(initialWidgets);
  const [error, setError] = useState<string | null>(null);
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press on touch screens, so that scrolling the page does not move a widget.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const types = useMemo(() => {
    const map = new Map<string, { service: ServiceSummary; widget: WidgetSummary }>();
    for (const service of services) {
      for (const widget of service.widgets) map.set(`${service.id}/${widget.id}`, { service, widget });
    }
    return map;
  }, [services]);

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  /**
   * Dropped on a widget, the two swap places: inserting would shift every
   * widget after it and dense packing would then rearrange the whole grid.
   */
  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const previous = widgets;
    const from = previous.findIndex((widget) => widget.id === active.id);
    const toEnd = over.id === END;
    const to = toEnd ? previous.length - 1 : previous.findIndex((widget) => widget.id === over.id);
    if (from === to) return;
    setError(null);

    if (toEnd) {
      setWidgets(move(previous, from, to));
      const { error } = await widgetsClient.update(String(active.id), { position: to });
      if (error) fail(previous, error.message);
      return;
    }

    const swapped = [...previous];
    [swapped[from], swapped[to]] = [swapped[to], swapped[from]];
    setWidgets(swapped);
    // Two moves make a swap: once the first is done, the other widget sits next to `to`.
    const first = await widgetsClient.update(String(active.id), { position: to });
    const second = first.error ? first : await widgetsClient.update(String(over.id), { position: from });
    if (second.error) fail(previous, second.error.message);
  }

  /** Back to what the API holds, since a swap may have half succeeded. */
  async function fail(previous: WidgetInstance[], message: string) {
    setError(message);
    const { data } = await widgetsClient.list();
    setWidgets(data ?? previous);
  }

  function onSaved(saved: WidgetInstance) {
    setWidgets((current) => current.map((widget) => (widget.id === saved.id ? saved : widget)));
  }

  function onDeleted(id: string) {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
  }

  const activeWidget = widgets.find((widget) => widget.id === activeId);
  const active = activeWidget && {
    widget: activeWidget,
    type: types.get(`${activeWidget.serviceId}/${activeWidget.widgetId}`),
  };

  function onAdded(widget: WidgetInstance) {
    setWidgets((current) => [...current, widget]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button size="sm" onClick={() => openAddPanel()}>
          <Plus aria-hidden />
          Add widget
        </Button>
      </div>

      <FormError message={error} />

      {widgets.length === 0 ? (
        <EmptyDashboard services={services} onAdded={onAdded} onBrowse={() => openAddPanel()} />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {/*
            Every widget spans whole cells of the same height, and dense packing
            moves a later widget into any hole that fits it: no gap is left.
          */}
          <div className="grid grid-flow-row-dense auto-rows-[18rem] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {widgets.map((widget) => {
              const type = types.get(`${widget.serviceId}/${widget.widgetId}`);
              return (
                <WidgetCard
                  key={widget.id}
                  instance={widget}
                  service={type?.service}
                  widget={type?.widget}
                  size={catalogEntry(widget.serviceId, widget.widgetId).size}
                  onSaved={onSaved}
                  onDeleted={onDeleted}
                />
              );
            })}
            <AddTile />
          </div>
          <DragOverlay dropAnimation={null}>
            {active && (
              <DraggedCard
                name={active.type?.widget.name ?? "Widget"}
                serviceName={active.type?.service.name ?? active.widget.serviceId}
                icon={catalogEntry(active.widget.serviceId, active.widget.widgetId).icon}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      <AddWidgetPanel services={services} onAdded={onAdded} />
    </div>
  );
}
