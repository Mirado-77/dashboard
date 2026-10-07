"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useId, useMemo, useState } from "react";
import { FormError } from "@/components/auth/field";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceSummary, WidgetSummary } from "@/lib/services/types";
import { widgetsClient } from "@/lib/widgets/client";
import type { WidgetInstance } from "@/lib/widgets/types";
import { AddWidgetDialog } from "./add-widget-dialog";
import { WidgetCard } from "./widget-card";

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const types = useMemo(() => {
    const map = new Map<string, { service: ServiceSummary; widget: WidgetSummary }>();
    for (const service of services) {
      for (const widget of service.widgets) map.set(`${service.id}/${widget.id}`, { service, widget });
    }
    return map;
  }, [services]);

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = widgets;
    const from = previous.findIndex((widget) => widget.id === active.id);
    const to = previous.findIndex((widget) => widget.id === over.id);
    setWidgets(arrayMove(previous, from, to));
    setError(null);

    const { error } = await widgetsClient.update(String(active.id), { position: to });
    if (error) {
      setWidgets(previous);
      setError(error.message);
    }
  }

  function onSaved(saved: WidgetInstance) {
    setWidgets((current) => current.map((widget) => (widget.id === saved.id ? saved : widget)));
  }

  function onDeleted(id: string) {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <AddWidgetDialog services={services} onAdded={(widget) => setWidgets((current) => [...current, widget])} />
      </div>

      <FormError message={error} />

      {widgets.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No widgets yet</CardTitle>
            <CardDescription>
              Add a widget to start. Widgets come from the services you subscribe to.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={widgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {widgets.map((widget) => {
                const type = types.get(`${widget.serviceId}/${widget.widgetId}`);
                return (
                  <WidgetCard
                    key={widget.id}
                    instance={widget}
                    service={type?.service}
                    widget={type?.widget}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
