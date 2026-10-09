import { WidgetView } from "@/components/widgets/widget-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { catalogEntry } from "@/lib/widgets/catalog";
import { cn } from "@/lib/utils";

/** The widget drawn with sample data: what it looks like before adding it. */
export function WidgetPreview({
  serviceId,
  widgetId,
  name,
  serviceName,
  className,
}: {
  serviceId: string;
  widgetId: string;
  name: string;
  serviceName: string;
  className?: string;
}) {
  const { sample } = catalogEntry(serviceId, widgetId);

  return (
    <Card className={cn("pointer-events-none gap-4 select-none", className)} aria-label={`Preview of ${name}`}>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{serviceName}</CardDescription>
      </CardHeader>
      <CardContent>
        {sample === null ? (
          <p className="text-sm text-muted-foreground">No preview for this widget.</p>
        ) : (
          <WidgetView serviceId={serviceId} widgetId={widgetId} data={sample} />
        )}
      </CardContent>
    </Card>
  );
}
