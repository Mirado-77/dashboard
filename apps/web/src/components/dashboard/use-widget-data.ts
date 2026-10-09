"use client";

import { useCallback, useEffect, useState } from "react";
import { widgetsClient } from "@/lib/widgets/client";
import { REFRESH_ALL_WIDGETS } from "@/lib/widgets/events";

interface WidgetDataState {
  /** The configuration the data belongs to. */
  version: string;
  data: unknown;
  error: string | null;
  updatedAt: Date | null;
}

/**
 * The timer of one widget instance: loads its data now, then every
 * `refreshRate` seconds. A new `version` (a reconfiguration) restarts it and
 * drops the data of the previous configuration.
 */
export function useWidgetData(id: string, refreshRate: number, version: string) {
  const [state, setState] = useState<WidgetDataState | null>(null);
  const [manual, setManual] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await widgetsClient.data(id);
      if (cancelled) return;
      setState((previous) => {
        if (!error) return { version, data: data.data, error: null, updatedAt: new Date() };
        // A failed refresh keeps the last data of the same configuration.
        return previous?.version === version
          ? { ...previous, error: error.message }
          : { version, data: null, error: error.message, updatedAt: null };
      });
    }

    void load();
    const timer = setInterval(() => void load(), refreshRate * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, refreshRate, version, manual]);

  const reload = useCallback(() => setManual((count) => count + 1), []);

  useEffect(() => {
    window.addEventListener(REFRESH_ALL_WIDGETS, reload);
    return () => window.removeEventListener(REFRESH_ALL_WIDGETS, reload);
  }, [reload]);
  const current = state?.version === version ? state : null;

  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current === null,
    updatedAt: current?.updatedAt ?? null,
    reload,
  };
}
