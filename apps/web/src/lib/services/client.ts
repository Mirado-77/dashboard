import { apiRequest as request } from "@/lib/api/request";
import type { ServiceSummary } from "./types";

export const servicesClient = {
  list: () => request<ServiceSummary[]>("/services"),
  subscribe: (serviceId: string, credentials: Record<string, string> = {}) =>
    request<ServiceSummary>(`/services/${serviceId}/subscribe`, {
      method: "POST",
      body: credentials,
    }),
  unsubscribe: (serviceId: string) =>
    request<{ success: boolean }>(`/services/${serviceId}/subscribe`, {
      method: "DELETE",
    }),
};
