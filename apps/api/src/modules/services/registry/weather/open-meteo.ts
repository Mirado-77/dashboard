/*
 ** EPITECH PROJECT, 2026
 ** G-WEB-500-PAR-5-1-dashboard-10
 ** File description:
 ** open-meteo
 */

import { WidgetDataError } from '../errors.js';
import { TtlCache } from '../../../../common/ttl-cache.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 5000;

const places = new TtlCache<Place>();
const ONE_DAY = 24 * 60 * 60;

export interface OpenMeteoForecast {
  current: {
    time: string;
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

async function getJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new WidgetDataError(`Open-Meteo answered ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface Place {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export async function findCity(city: string): Promise<Place> {
  return places.get(city.trim().toLowerCase(), ONE_DAY, async () => {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set('name', city);
    url.searchParams.set('count', '1');
    const data = await getJson<{ results?: Place[] }>(url);
    const place = data.results?.[0];
    if (!place) throw new WidgetDataError(`Unknown city: ${city}`);
    return place;
  });
}

export async function getForecast(place: Place, days: number) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(place.latitude));
  url.searchParams.set('longitude', String(place.longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,weather_code',
  );
  url.searchParams.set('forecast_days', String(days));
  url.searchParams.set('timezone', 'auto');
  return getJson<OpenMeteoForecast>(url);
}
