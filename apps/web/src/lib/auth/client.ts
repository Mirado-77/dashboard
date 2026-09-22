import type { AuthResult, Session, User, UserList } from "./types";

/**
 * Browser auth client. Pages and components only use this object, so another
 * auth library can replace the implementation behind the same shape.
 */

async function request<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<AuthResult<T>> {
  try {
    const response = await fetch(`/api/auth${path}`, {
      method: init.method ?? "GET",
      headers:
        init.body === undefined ? undefined : { "content-type": "application/json" },
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

interface SocialFlow {
  provider: string;
  callbackURL?: string;
  errorCallbackURL?: string;
  scopes?: string[];
}

/** Starts an OAuth flow and sends the browser to the provider. */
async function redirectTo(result: AuthResult<{ url: string }>) {
  if (result.data) window.location.assign(result.data.url);
  return result;
}

export const authClient = {
  signUp: {
    email: (body: { name: string; email: string; password: string; callbackURL?: string }) =>
      request<{ user: User; token: string | null }>("/sign-up/email", {
        method: "POST",
        body,
      }),
  },
  signIn: {
    email: (body: { email: string; password: string; rememberMe?: boolean; callbackURL?: string }) =>
      request<{ user: User }>("/sign-in/email", { method: "POST", body }),
    social: async (body: SocialFlow) =>
      redirectTo(await request<{ url: string }>("/sign-in/social", { method: "POST", body })),
  },
  linkSocial: async (body: SocialFlow) =>
    redirectTo(await request<{ url: string }>("/link-social", { method: "POST", body })),
  unlinkAccount: (body: { providerId: string }) =>
    request<{ status: boolean }>("/unlink-account", { method: "POST", body }),
  updateUser: (body: { name: string }) =>
    request<{ user: User }>("/update-user", { method: "POST", body }),
  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions?: boolean;
  }) => request<{ success: boolean }>("/update-password", { method: "POST", body }),
  signOut: () => request<{ success: boolean }>("/sign-out", { method: "POST" }),
  getSession: () => request<Session | null>("/get-session"),
  sendVerificationEmail: (body: { email: string; callbackURL?: string }) =>
    request<{ status: boolean }>("/send-verification-email", {
      method: "POST",
      body,
    }),
  admin: {
    listUsers: (query: { search?: string; limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== "") params.set(key, String(value));
      }
      return request<UserList>(`/admin/list-users?${params}`);
    },
    setRole: (body: { userId: string; role: User["role"] }) =>
      request<{ user: User }>("/admin/set-role", { method: "POST", body }),
    banUser: (body: { userId: string; banReason?: string }) =>
      request<{ user: User }>("/admin/ban-user", { method: "POST", body }),
    unbanUser: (body: { userId: string }) =>
      request<{ user: User }>("/admin/unban-user", { method: "POST", body }),
    revokeUserSessions: (body: { userId: string }) =>
      request<{ success: boolean }>("/admin/revoke-user-sessions", { method: "POST", body }),
    removeUser: (body: { userId: string }) =>
      request<{ success: boolean }>("/admin/remove-user", { method: "POST", body }),
  },
};

export type AuthClient = typeof authClient;
