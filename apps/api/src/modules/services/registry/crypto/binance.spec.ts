import { WidgetDataError } from '../errors.js';
import { getDailyCloses, getPairPrice } from './binance.js';

function answer(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('binance', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function calledUrl(): URL {
    return fetchMock.mock.calls[0][0] as URL;
  }

  describe('getPairPrice', () => {
    it('reads the price of the pair as numbers', async () => {
      fetchMock.mockResolvedValue(
        answer({
          symbol: 'BTCEUR',
          lastPrice: '72685.58000000',
          priceChangePercent: '-2.170',
          highPrice: '74742.20000000',
          lowPrice: '72537.55000000',
        }),
      );

      await expect(getPairPrice('BTCEUR')).resolves.toEqual({
        price: 72685.58,
        changePercent: -2.17,
        high: 74742.2,
        low: 72537.55,
      });
      expect(calledUrl().pathname).toBe('/api/v3/ticker/24hr');
      expect(calledUrl().searchParams.get('symbol')).toBe('BTCEUR');
    });
  });

  describe('getDailyCloses', () => {
    it('keeps the day and the closing price of each line', async () => {
      fetchMock.mockResolvedValue(
        answer([
          [
            1791331200000,
            '74296.63',
            '74742.20',
            '72537.55',
            '74363.08',
            '89.96',
          ],
          [
            1791417600000,
            '74356.89',
            '74564.12',
            '72537.55',
            '72674.60',
            '78.77',
          ],
        ]),
      );

      await expect(getDailyCloses('BTCEUR', 2)).resolves.toEqual([
        { date: '2026-10-07', close: 74363.08 },
        { date: '2026-10-08', close: 72674.6 },
      ]);
      const params = calledUrl().searchParams;
      expect(params.get('interval')).toBe('1d');
      expect(params.get('limit')).toBe('2');
    });
  });

  it.each([
    [400, /unknown pair: BTCXYZ/i],
    [418, /too many requests/i],
    [429, /too many requests/i],
    [503, /binance answered 503/i],
  ])('turns a %d into a readable error', async (status, message) => {
    fetchMock.mockResolvedValue(answer({ code: -1121 }, status));

    const error = await getPairPrice('BTCXYZ').catch(
      (failure: unknown) => failure,
    );

    expect(error).toBeInstanceOf(WidgetDataError);
    expect((error as Error).message).toMatch(message);
  });

  it.each(['btceur', 'BTC', 'BTC/EUR', 'BTCEUR&limit=1000', ''])(
    'refuses the pair %j without calling Binance',
    async (symbol) => {
      await expect(getPairPrice(symbol)).rejects.toThrow(WidgetDataError);
      await expect(getDailyCloses(symbol, 7)).rejects.toThrow(WidgetDataError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
