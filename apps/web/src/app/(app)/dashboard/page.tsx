import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>No widgets yet</CardTitle>
          <CardDescription>Services and widgets are not implemented yet.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
