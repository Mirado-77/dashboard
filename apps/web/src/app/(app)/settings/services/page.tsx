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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Services</h1>
        <p className="text-sm text-muted-foreground">
          Each service brings its widgets. Most are ready to use; connect the others once.
        </p>
      </div>
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No service is available yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} autoSubscribe={subscribe === service.id} />
          ))}
        </div>
      )}
    </main>
  );
}
