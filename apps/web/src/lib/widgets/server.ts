import "server-only";
import { cookies } from "next/headers";
import type { WidgetInstance } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export async function listWidgets(): Promise<WidgetInstance[]> {
  const response = await fetch(`${API_URL}/api/widgets`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as WidgetInstance[]) : [];
}
