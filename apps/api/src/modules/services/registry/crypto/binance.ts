import z from 'zod';
import { WidgetDataError } from '../errors.js';

const BINANCE_URL = 'https://api.binance.com/api/v3';
const TIMEOUT_MS = 5000;

interface BinanceResponse {
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
}

export interface PairPrice {
  price: number;
  changePercent: number;
  high: number;
  low: number;
}

export interface DailyClose {
  date: string;
  close: number;
}

const symbolSchema = z.string().regex(/^[A-Z0-9]{5,20}$/);

async function getJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    switch (response.status) {
      case 400:
        throw new WidgetDataError(
          `Unknown pair: ${url.searchParams.get('symbol')}`,
        );
      case 418:
      case 429:
        throw new WidgetDataError('Too many requests, please try again later');
      default:
        throw new WidgetDataError(`Binance answered ${response.status}`);
    }
  }
  return (await response.json()) as T;
}

export async function getPairPrice(symbol: string) {
  checkSymbol(symbol);
  const url = new URL(`${BINANCE_URL}/ticker/24hr`);
  url.searchParams.set('symbol', symbol);

  const data = await getJson<BinanceResponse>(url);
  const result: PairPrice = {
    price: Number(data.lastPrice),
    changePercent: Number(data.priceChangePercent),
    high: Number(data.highPrice),
    low: Number(data.lowPrice),
  };
  return result;
}

function checkSymbol(symbol: string): void {
  const result = symbolSchema.safeParse(symbol);
  if (!result.success) {
    throw new WidgetDataError(`Invalid pair ${symbol}`);
  }
}

export async function getDailyCloses(
  symbol: string,
  days: number,
): Promise<DailyClose[]> {
  checkSymbol(symbol);
  const url = new URL(`${BINANCE_URL}/klines`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('limit', String(days));

  const data = await getJson<(string | number)[][]>(url);
  const dailyCloses = data.map((row) => {
    return {
      date: new Date(Number(row[0])).toISOString().slice(0, 10),
      close: Number(row[4]),
    };
  });
  return dailyCloses;
}
