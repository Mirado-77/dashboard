import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 data-slot="card-title" className="text-xl leading-none font-semibold">
            {title}
          </h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">{children}</CardContent>
      </Card>
    </main>
  );
}
