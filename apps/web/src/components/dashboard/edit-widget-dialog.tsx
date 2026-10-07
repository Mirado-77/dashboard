"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WidgetSummary } from "@/lib/services/types";
import { widgetsClient } from "@/lib/widgets/client";
import type { WidgetConfig, WidgetInstance } from "@/lib/widgets/types";
import { WidgetForm } from "./widget-form";

export function EditWidgetDialog({
  instance,
  widget,
  open,
  onOpenChange,
  onSaved,
}: {
  instance: WidgetInstance;
  widget: WidgetSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (widget: WidgetInstance) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(config: WidgetConfig, refreshRate: number) {
    setPending(true);
    setError(null);

    const { data, error } = await widgetsClient.update(instance.id, { config, refreshRate });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    onSaved(data);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {widget.name}</DialogTitle>
          <DialogDescription>{widget.description}</DialogDescription>
        </DialogHeader>
        <WidgetForm
          widget={widget}
          config={instance.config}
          refreshRate={instance.refreshRate}
          error={error}
          onSubmit={save}
        >
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Please wait…" : "Save"}
            </Button>
          </DialogFooter>
        </WidgetForm>
      </DialogContent>
    </Dialog>
  );
}
