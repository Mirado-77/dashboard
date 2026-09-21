import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { LinkedAccount, Provider, Session } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/** Reads the current session from the API. Deduplicated per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  const response = await fetch(`${API_URL}/api/auth/get-session`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as Session | null;
});

/** Returns the session or redirects to the sign-in page. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Returns an admin session, redirects everyone else. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");
  return session;
}

export async function getProviders(): Promise<Provider[]> {
  const response = await fetch(`${API_URL}/api/auth/providers`, { cache: "no-store" });
  return response.ok ? ((await response.json()) as Provider[]) : [];
}

export async function listAccounts(): Promise<LinkedAccount[]> {
  const response = await fetch(`${API_URL}/api/auth/list-accounts`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as LinkedAccount[]) : [];
}
