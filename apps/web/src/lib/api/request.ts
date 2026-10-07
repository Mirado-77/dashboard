import type { AuthResult } from "@/lib/auth/types";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Calls the API from the browser, through the `/api` proxy of the web app. */
export async function apiRequest<T>(
  path: string,
  init: { method: Method; body?: unknown } = { method: "GET" },
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
