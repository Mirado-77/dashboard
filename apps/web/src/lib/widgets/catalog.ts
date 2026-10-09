import {
  CalendarClock,
  CalendarDays,
  ChartLine,
  CloudSun,
  Coins,
  LayoutGrid,
  Newspaper,
  Plug,
  Rss,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import type { CalendarEvent } from "@/components/widgets/calendar-events";
import type { PriceHistoryData } from "@/components/widgets/crypto-history";
import type { PairPriceData } from "@/components/widgets/crypto-price";
import type { ArticleListData, LatestArticleData } from "@/components/widgets/rss-articles";
import type { ForecastData } from "@/components/widgets/weather-forecast";
import type { CityTemperatureData } from "@/components/widgets/weather-temperature";
import type { WidgetConfig } from "./types";

/**
 * In grid cells, all the same height so that widgets fit together without
 * holes: `small` is 1 cell, `tall` 1 column by 2 cells, `large` 2 by 2.
 */
export type WidgetSize = "small" | "tall" | "large";

export interface CatalogEntry {
  size: WidgetSize;
  icon: LucideIcon;
  /** Fixed data showing what the widget looks like, before any API call. */
  sample: unknown;
}

/** Suggested on an empty dashboard: one click, no account needed. */
export interface Suggestion {
  serviceId: string;
  widgetId: string;
  config: WidgetConfig;
  label: string;
}

/** `count` days in a row, starting `offset` days from today. */
function days(count: number, offset = 0): string[] {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() + offset + index);
    return day.toISOString().slice(0, 10);
  });
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

const closes = [61.2, 62.8, 62.1, 64.5, 63.9, 66.4, 65.7, 68.2, 67.5, 69.9, 71.3, 70.6, 72.4, 72.0];

const sampleEvents: CalendarEvent[] = [
  {
    id: "sample-1",
    title: "Team meeting",
    start: hoursFromNow(1),
    end: hoursFromNow(2),
    allDay: false,
    location: "Room 4",
    link: null,
  },
  {
    id: "sample-2",
    title: "Project review",
    start: hoursFromNow(26),
    end: hoursFromNow(27),
    allDay: false,
    location: null,
    link: null,
  },
];

const catalog: Record<string, CatalogEntry> = {
  "weather/city_temperature": {
    size: "small",
    icon: Thermometer,
    sample: {
      city: "Paris",
      country: "France",
      temperature: 18,
      windSpeed: 12,
      weatherCode: 1,
    } satisfies CityTemperatureData,
  },
  "weather/forecast": {
    size: "small",
    icon: CloudSun,
    sample: {
      city: "Paris",
      days: days(3).map((date, index) => ({
        date,
        min: 9 + index,
        max: 17 + index,
        weatherCode: [1, 3, 61][index],
      })),
    } satisfies ForecastData,
  },
  "rss/article_list": {
    size: "tall",
    icon: Rss,
    sample: {
      title: "Tech news",
      items: [
        { title: "A new web framework is out", link: null, date: hoursFromNow(-2), summary: null },
        { title: "How browsers render a page", link: null, date: hoursFromNow(-20), summary: null },
        { title: "Ten tips for faster builds", link: null, date: hoursFromNow(-40), summary: null },
      ],
    } satisfies ArticleListData,
  },
  "rss/latest_article": {
    size: "small",
    icon: Newspaper,
    sample: {
      title: "Tech news",
      item: {
        title: "A new web framework is out",
        link: null,
        date: hoursFromNow(-2),
        summary: "It promises faster pages and a simpler way to fetch data.",
      },
    } satisfies LatestArticleData,
  },
  "google-calendar/upcoming_events": {
    size: "tall",
    icon: CalendarDays,
    sample: sampleEvents,
  },
  "google-calendar/today_events": {
    size: "small",
    icon: CalendarClock,
    sample: sampleEvents.slice(0, 1),
  },
  "crypto/pair_price": {
    size: "small",
    icon: Coins,
    sample: {
      pair: "BTC/EUR",
      price: 72001.45,
      changePercent: 1.84,
      high: 72650.08,
      low: 70643.98,
    } satisfies PairPriceData,
  },
  "crypto/price_history": {
    size: "large",
    icon: ChartLine,
    sample: {
      pair: "BTC/EUR",
      points: days(closes.length, 1 - closes.length).map((date, index) => ({
        date,
        close: closes[index] * 1000,
      })),
    } satisfies PriceHistoryData,
  },
};

const serviceIcons: Record<string, LucideIcon> = {
  weather: CloudSun,
  rss: Rss,
  "google-calendar": CalendarDays,
  crypto: Coins,
};

export function serviceIcon(serviceId: string): LucideIcon {
  return serviceIcons[serviceId] ?? Plug;
}

const fallback: CatalogEntry = { size: "small", icon: LayoutGrid, sample: null };

export function catalogEntry(serviceId: string, widgetId: string): CatalogEntry {
  return catalog[`${serviceId}/${widgetId}`] ?? fallback;
}

export const suggestions: Suggestion[] = [
  { serviceId: "weather", widgetId: "city_temperature", config: { city: "Paris" }, label: "Weather in Paris" },
  { serviceId: "crypto", widgetId: "pair_price", config: { base: "BTC" }, label: "Bitcoin price" },
  {
    serviceId: "rss",
    widgetId: "article_list",
    config: { url: "https://www.lemonde.fr/rss/une.xml" },
    label: "Le Monde headlines",
  },
];
