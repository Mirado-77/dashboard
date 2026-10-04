import type { Widget } from './registry/types.js';
import {
  configToStore,
  moveTo,
  parseCreateWidget,
  parseUpdateWidget,
  refreshRateToStore,
} from './widgets.rules.js';

const forecast: Widget = {
  id: 'forecast',
  name: 'Forecast',
  description: 'Forecast of a city',
  params: [
    { name: 'city', type: 'string', required: true },
    { name: 'days', type: 'integer', required: false, defaultValue: 3 },
  ],
  defaultRefreshRate: 1800,
  minRefreshRate: 300,
  getWidgetData: async () => null,
};

describe('parseCreateWidget', () => {
  it('keeps what identifies the widget, with an empty config by default', () => {
    expect(
      parseCreateWidget({ serviceId: 'weather', widgetId: 'forecast' }),
    ).toEqual({ serviceId: 'weather', widgetId: 'forecast', config: {} });
  });

  it('refuses a missing id, an unknown key or a body that is not an object', () => {
    expect(() => parseCreateWidget({ serviceId: 'weather' })).toThrow();
    expect(() =>
      parseCreateWidget({
        serviceId: 'weather',
        widgetId: 'forecast',
        userId: 'someone-else',
      }),
    ).toThrow();
    expect(() => parseCreateWidget('forecast')).toThrow();
    expect(() => parseCreateWidget(undefined)).toThrow();
  });

  it('refuses a refresh rate that is not a positive integer', () => {
    const ids = { serviceId: 'weather', widgetId: 'forecast' };
    expect(() => parseCreateWidget({ ...ids, refreshRate: 0 })).toThrow();
    expect(() => parseCreateWidget({ ...ids, refreshRate: 1.5 })).toThrow();
    expect(() => parseCreateWidget({ ...ids, refreshRate: '600' })).toThrow();
    expect(() => parseCreateWidget({ ...ids, refreshRate: 1e9 })).toThrow();
  });
});

describe('parseUpdateWidget', () => {
  it('accepts any subset of what can change', () => {
    expect(parseUpdateWidget({})).toEqual({});
    expect(parseUpdateWidget({ position: 2 })).toEqual({ position: 2 });
  });

  it('refuses to move a widget to another service or below zero', () => {
    expect(() => parseUpdateWidget({ serviceId: 'rss' })).toThrow();
    expect(() => parseUpdateWidget({ position: -1 })).toThrow();
  });
});

describe('configToStore', () => {
  it('fills in the defaults and coerces integers', () => {
    expect(configToStore(forecast, { city: 'Paris' })).toEqual({
      city: 'Paris',
      days: 3,
    });
    expect(configToStore(forecast, { city: 'Paris', days: '7' })).toEqual({
      city: 'Paris',
      days: 7,
    });
  });

  it('refuses a missing, blank, mistyped or unknown parameter', () => {
    expect(() => configToStore(forecast, {})).toThrow();
    expect(() => configToStore(forecast, undefined)).toThrow();
    expect(() => configToStore(forecast, { city: '   ' })).toThrow();
    expect(() =>
      configToStore(forecast, { city: 'Paris', days: 'many' }),
    ).toThrow();
    expect(() =>
      configToStore(forecast, { city: 'Paris', unit: 'kelvin' }),
    ).toThrow();
  });

  it('names the expected parameters', () => {
    try {
      configToStore(forecast, {});
      throw new Error('should have thrown');
    } catch (error) {
      expect(
        JSON.stringify((error as { response?: unknown }).response),
      ).toContain('city (string), days (integer)');
    }
  });
});

describe('refreshRateToStore', () => {
  it('uses the default of the widget when none is asked', () => {
    expect(refreshRateToStore(forecast)).toBe(1800);
  });

  it('accepts a rate down to the minimum of the widget', () => {
    expect(refreshRateToStore(forecast, 300)).toBe(300);
    expect(refreshRateToStore(forecast, 3600)).toBe(3600);
  });

  it('refuses a rate below the minimum', () => {
    expect(() => refreshRateToStore(forecast, 299)).toThrow(/300 seconds/);
  });
});

describe('moveTo', () => {
  it('moves a widget up or down, shifting the ones in between', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 'd', 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('clamps a position past the end', () => {
    expect(moveTo(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a']);
  });

  it('changes nothing when the widget stays in place', () => {
    expect(moveTo(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });
});
