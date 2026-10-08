import type { Metadata } from "next";
import { ServiceCard } from "@/components/settings/service-card";
import { listServices } from "@/lib/services/server";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [services, { subscribe }] = await Promise.all([listServices(), searchParams]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Services</h1>
        <p className="text-sm text-foreground/70">
          Services without an account are available by default. Subscribe to the others to
          use their widgets on your dashboard.
        </p>
      </div>
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No service is available yet.</p>
      ) : (
        services.map((service) => (
          <ServiceCard key={service.id} service={service} autoSubscribe={subscribe === service.id} />
        ))
      )}
    </main>
  );
}
