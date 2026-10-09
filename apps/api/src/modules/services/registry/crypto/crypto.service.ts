import type { Service, WidgetContext } from '../types.js';
import { getDailyCloses, getPairPrice } from './binance.js';

/** `btc` and `eur` give `BTCEUR` for Binance and `BTC/EUR` to display. */
function pairOf(config: WidgetContext['config']) {
  const base = String(config.base).trim().toUpperCase();
  const quote = String(config.quote).trim().toUpperCase();
  return { symbol: base + quote, pair: `${base}/${quote}` };
}

export const cryptoMarkets: Service = {
  id: 'crypto',
  name: 'Crypto markets',
  description: 'Prices of crypto pairs, from Binance',
  providerType: 'none',
  widgets: [
    {
      id: 'pair_price',
      name: 'Pair price',
      description: 'Current price of a pair, with its 24h change',
      params: [
        { name: 'base', type: 'string', required: true },
        { name: 'quote', type: 'string', required: false, defaultValue: 'EUR' },
      ],
      defaultRefreshRate: 600,
      minRefreshRate: 60,
      async getWidgetData({ config }) {
        const { symbol, pair } = pairOf(config);

        const prices = await getPairPrice(symbol);
        return { pair: pair, ...prices };
      },
    },
    {
      id: 'price_history',
      name: 'Price history',
      description: 'Daily closing prices of a pair',
      params: [
        { name: 'base', type: 'string', required: true },
        { name: 'quote', type: 'string', required: false, defaultValue: 'EUR' },
        { name: 'days', type: 'integer', required: false, defaultValue: 30 },
      ],
      defaultRefreshRate: 600,
      minRefreshRate: 60,
      async getWidgetData({ config }) {
        const { symbol, pair } = pairOf(config);

        const points = await getDailyCloses(
          symbol,
          Math.min(Math.max(Number(config.days), 2), 90),
        );
        return { pair: pair, points: points };
      },
    },
  ],
};
