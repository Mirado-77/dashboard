import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";
import { listServices } from "@/lib/services/server";
import { listWidgets } from "@/lib/widgets/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [services, widgets] = await Promise.all([listServices(), listWidgets()]);

  return (
    <main className="flex flex-1 flex-col p-4 md:p-6">
      <Dashboard services={services} initialWidgets={widgets} />
    </main>
  );
}
