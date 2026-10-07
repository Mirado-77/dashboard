// Mirrors apps/api/src/database/schema/widgets.ts (dates are serialized).

export type WidgetConfig = Record<string, string | number>;

export interface WidgetInstance {
  id: string;
  serviceId: string;
  widgetId: string;
  config: WidgetConfig;
  /** In seconds. */
  refreshRate: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewWidget {
  serviceId: string;
  widgetId: string;
  config: WidgetConfig;
  refreshRate: number;
}

export interface WidgetChanges {
  config?: WidgetConfig;
  refreshRate?: number;
  position?: number;
}
