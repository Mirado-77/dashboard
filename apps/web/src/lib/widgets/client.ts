import { apiRequest as request } from "@/lib/api/request";
import type { NewWidget, WidgetChanges, WidgetInstance } from "./types";

export const widgetsClient = {
  list: () => request<WidgetInstance[]>("/widgets"),
  create: (widget: NewWidget) =>
    request<WidgetInstance>("/widgets", { method: "POST", body: widget }),
  update: (id: string, changes: WidgetChanges) =>
    request<WidgetInstance>(`/widgets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: changes,
    }),
  remove: (id: string) =>
    request<{ success: boolean }>(`/widgets/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  data: (id: string) =>
    request<{ data: unknown }>(`/widgets/${encodeURIComponent(id)}/data`),
};
