import type { AuthResult } from "@/lib/auth/types";
import type { ServiceSummary } from "./types";

async function request<T>(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown } = { method: "GET" },
): Promise<AuthResult<T>> {
  try {
    const response = await fetch(`/api${path}`, {
      method: init.method,
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        data: null,
        error: {
          code: data?.code ?? "UNKNOWN_ERROR",
          message: data?.message ?? "Something went wrong",
          status: response.status,
        },
      };
    }
    return { data: data as T, error: null };
  } catch {
    return {
      data: null,
      error: { code: "NETWORK_ERROR", message: "Network error", status: 0 },
    };
  }
}

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
