import "server-only";
import { cookies } from "next/headers";
import type { ServiceSummary } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export async function listServices(): Promise<ServiceSummary[]> {
  const response = await fetch(`${API_URL}/api/services`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as ServiceSummary[]) : [];
}
