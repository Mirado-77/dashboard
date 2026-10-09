"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { WidgetView } from "@/components/widgets/widget-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ServiceSummary, WidgetSummary } from "@/lib/services/types";
import type { WidgetSize } from "@/lib/widgets/catalog";
import type { WidgetInstance } from "@/lib/widgets/types";
import { cn } from "@/lib/utils";
import { DeleteWidgetDialog } from "./delete-widget-dialog";
import { EditWidgetDialog } from "./edit-widget-dialog";
import { useWidgetData } from "./use-widget-data";

const SIZE_CLASSES: Record<WidgetSize, string> = {
  small: "",
  tall: "row-span-2",
  large: "row-span-2 md:col-span-2",
};

function formatRate(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

function WidgetBody({ instance }: { instance: WidgetInstance }) {
  const { data, error, loading, updatedAt, reload } = useWidgetData(
    instance.id,
    instance.refreshRate,
    instance.updatedAt,
  );

  return (
    <>
      {/* The card has the height of its cells: a longer content scrolls inside. */}
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2" aria-label="Loading">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {updatedAt && (
              <WidgetView serviceId={instance.serviceId} widgetId={instance.widgetId} data={data} />
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Every {formatRate(instance.refreshRate)}
          {updatedAt &&
            ` · updated ${updatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
        </span>
        <Button variant="ghost" size="icon-xs" onClick={reload} aria-label="Refresh now">
          <RefreshCw aria-hidden />
        </Button>
      </CardFooter>
    </>
  );
}

export function WidgetCard({
  instance,
  service,
  widget,
  size,
  onSaved,
  onDeleted,
}: {
  instance: WidgetInstance;
  service: ServiceSummary | undefined;
  widget: WidgetSummary | undefined;
  size: WidgetSize;
  onSaved: (widget: WidgetInstance) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The card itself never moves: a copy follows the pointer, the swap happens on drop.
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({ id: instance.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: instance.id });
  const name = widget?.name ?? "Unknown widget";
  const isTarget = isOver && !isDragging;

  return (
    <Card
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={cn(
        "flex min-h-0 flex-col gap-4 overflow-hidden transition-[opacity,box-shadow]",
        SIZE_CLASSES[size],
        isDragging && "opacity-40",
        isTarget && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <CardHeader className="flex flex-row items-start gap-2">
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon-sm"
          className="-ml-2 cursor-grab touch-none active:cursor-grabbing"
          aria-label={`Move ${name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">{name}</CardTitle>
          <CardDescription className="truncate">{service?.name ?? instance.serviceId}</CardDescription>
        </div>
        {widget && (
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Configure ${name}`}>
            <Settings2 aria-hidden />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(true)} aria-label={`Delete ${name}`}>
          <Trash2 aria-hidden />
        </Button>
      </CardHeader>

      {widget ? (
        <WidgetBody instance={instance} />
      ) : (
        <CardContent>
          <p className="text-sm text-muted-foreground">This widget is no longer available.</p>
        </CardContent>
      )}

      {widget && (
        <EditWidgetDialog
          instance={instance}
          widget={widget}
          open={editing}
          onOpenChange={setEditing}
          onSaved={onSaved}
        />
      )}
      <DeleteWidgetDialog
        id={instance.id}
        name={name}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={onDeleted}
      />
    </Card>
  );
}
