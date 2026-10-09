"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { servicesClient } from "@/lib/services/client";
import type { ServiceSummary } from "@/lib/services/types";

/** Where the provider sends the user back: the panel, on the same widget. */
export function connectCallback(serviceId: string, selection: string | null): string {
  const params = new URLSearchParams({ add: selection ?? "catalog", connect: serviceId });
  return `/dashboard?${params.toString()}`;
}

/**
 * Makes a service usable from the add panel. A granted `oauth` service only
 * needs the subscription; otherwise the user first goes through the provider.
 */
export function useConnectService(service: ServiceSummary, selection: string | null) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setPending(true);
    setError(null);

    if (service.providerType === "oauth" && !service.accessGranted) {
      const { error } = await authClient.linkSocial({
        provider: service.oauthProviderId,
        scopes: service.oauthScopes,
        callbackURL: connectCallback(service.id, selection),
      });
      if (error) {
        setError(error.message);
        setPending(false);
      }
      return;
    }

    const { error } = await servicesClient.subscribe(service.id);
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return { connect, pending, error };
}
