"use client";

import { useEffect, useState, type FormEvent } from "react";

interface Config {
  city: string;
  /** Seconds between two refreshes. */
  refreshRate: number;
}

interface CityWeather {
  city: string;
  country: string;
  temperature: number;
  windSpeed: number;
  weatherCode: number;
}

const DEFAULT_CONFIG: Config = { city: "Paris", refreshRate: 60 };
const STORAGE_KEY = "poc-widget-config";
const MIN_REFRESH = 10;
const MAX_REFRESH = 3600;

// WMO weather codes, as returned by Open-Meteo: upper bound of each group.
const WEATHER: [number, string][] = [
  [0, "Clear sky"],
  [3, "Cloudy"],
  [48, "Fog"],
  [57, "Drizzle"],
  [67, "Rain"],
  [77, "Snow"],
  [82, "Rain showers"],
  [86, "Snow showers"],
  [99, "Thunderstorm"],
];

function describe(code: number): string {
  return WEATHER.find(([max]) => code <= max)?.[1] ?? "Unknown";
}

function loadConfig(): Config {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof saved?.city === "string" && saved.refreshRate >= MIN_REFRESH) return saved;
  } catch {
    // No storage or a broken value: use the default configuration.
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: Config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // The configuration then only lasts until the page is closed.
  }
}

export function WeatherWidget() {
  const [config, setConfig] = useState<Config | null>(null);
  const [data, setData] = useState<CityWeather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [editing, setEditing] = useState(false);

  // localStorage only exists in the browser, so it is read after the first render.
  useEffect(() => setConfig(loadConfig()), []);

  // Loads now, then every `refreshRate` seconds; a new config restarts it.
  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    async function load(city: string) {
      try {
        const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? `Error ${response.status}`);
        if (cancelled) return;
        setData(body);
        setError(null);
        setUpdatedAt(new Date());
      } catch (cause) {
        // A failed refresh keeps the last data on screen.
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unknown error");
      }
    }

    void load(config.city);
    const timer = setInterval(() => void load(config.city), config.refreshRate * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [config]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Config = {
      city: String(form.get("city")).trim(),
      refreshRate: Number(form.get("refreshRate")),
    };
    saveConfig(next);
    setData(null);
    setError(null);
    setEditing(false);
    setConfig(next);
  }

  return (
    <section className="card" aria-labelledby="widget-title">
      <div className="header">
        <h2 id="widget-title">City temperature</h2>
        <button type="button" className="ghost" onClick={() => setEditing(!editing)}>
          {editing ? "Cancel" : "Configure"}
        </button>
      </div>

      {data ? (
        <div>
          <p className="muted">
            {data.city}, {data.country}
          </p>
          <p className="temperature">{Math.round(data.temperature)}°C</p>
          <p className="muted">
            {describe(data.weatherCode)} · wind {Math.round(data.windSpeed)} km/h
          </p>
        </div>
      ) : (
        !error && <p className="muted">Loading…</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {updatedAt && config && (
        <p className="muted">
          Updated at {updatedAt.toLocaleTimeString()} · every {config.refreshRate} s
        </p>
      )}

      {editing && config && (
        <form onSubmit={onSubmit}>
          <label>
            City
            <input name="city" required maxLength={100} defaultValue={config.city} />
          </label>
          <label>
            Refresh every (seconds)
            <input
              name="refreshRate"
              type="number"
              required
              min={MIN_REFRESH}
              max={MAX_REFRESH}
              defaultValue={config.refreshRate}
            />
          </label>
          <button type="submit">Save</button>
        </form>
      )}
    </section>
  );
}
