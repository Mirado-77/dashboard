import { buildConfigSchema } from './params.js';
import { ServiceRegistry } from './registry.js';
import type { Service, Widget, WidgetParam } from './types.js';

function widget(id: string, params: WidgetParam[] = []): Widget {
  return {
    id,
    name: id,
    description: `The ${id} widget`,
    params,
    defaultRefreshRate: 300,
    minRefreshRate: 30,
    getWidgetData: async () => ({ id }),
  };
}

function service(id: string, widgets: Widget[]): Service {
  return {
    id,
    name: id,
    description: `The ${id} service`,
    providerType: 'none',
    widgets,
  };
}

const weather = service('weather', [
  widget('city_temperature'),
  widget('forecast'),
]);
const rss = service('rss', [widget('article_list')]);

describe('ServiceRegistry', () => {
  it('lists every registered service', () => {
    const registry = new ServiceRegistry([weather, rss]);

    expect(registry.getAll().map((s) => s.id)).toEqual(['weather', 'rss']);
  });

  it('finds a service and a widget by id', () => {
    const registry = new ServiceRegistry([weather, rss]);

    expect(registry.getOne('weather')?.name).toBe('weather');
    expect(registry.getWidget('weather', 'forecast')?.id).toBe('forecast');
  });

  it('returns undefined for an unknown service or widget', () => {
    const registry = new ServiceRegistry([weather]);

    expect(registry.getOne('pizza')).toBeUndefined();
    expect(registry.getWidget('pizza', 'forecast')).toBeUndefined();
    expect(registry.getWidget('weather', 'pizza')).toBeUndefined();
  });

  it('does not leak a widget across services', () => {
    const registry = new ServiceRegistry([weather, rss]);

    expect(registry.getWidget('rss', 'forecast')).toBeUndefined();
  });

  it('rejects duplicate service ids', () => {
    expect(
      () => new ServiceRegistry([weather, service('weather', [])]),
    ).toThrow(/weather/);
  });

  it('rejects duplicate widget ids inside one service', () => {
    const duplicated = service('weather', [
      widget('forecast'),
      widget('forecast'),
    ]);

    expect(() => new ServiceRegistry([duplicated])).toThrow(/forecast/);
  });

  it('accepts the same widget id in two different services', () => {
    const other = service('github', [widget('forecast')]);

    expect(() => new ServiceRegistry([weather, other])).not.toThrow();
  });

  it('does not share its internal state with callers', () => {
    const registry = new ServiceRegistry([weather]);

    registry.getAll().pop();

    expect(registry.getAll()).toHaveLength(1);
  });
});

describe('buildConfigSchema', () => {
  const city: WidgetParam = { name: 'city', type: 'string', required: true };
  const days: WidgetParam = {
    name: 'days',
    type: 'integer',
    required: false,
    defaultValue: 3,
  };

  it('accepts a valid configuration', () => {
    const result = buildConfigSchema([city, days]).safeParse({
      city: 'Paris',
      days: 5,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ city: 'Paris', days: 5 });
  });

  it('fills in the default value when the parameter is missing', () => {
    const result = buildConfigSchema([city, days]).parse({ city: 'Paris' });

    expect(result).toEqual({ city: 'Paris', days: 3 });
  });

  it('rejects a missing required parameter', () => {
    const result = buildConfigSchema([city]).safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects a value of the wrong type', () => {
    const result = buildConfigSchema([city, days]).safeParse({
      city: 'Paris',
      days: 'many',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a float for an integer parameter', () => {
    const result = buildConfigSchema([days]).safeParse({ days: 1.5 });

    expect(result.success).toBe(false);
  });

  it('reads an integer sent as text', () => {
    const result = buildConfigSchema([days]).safeParse({ days: '7' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ days: 7 });
  });

  it.each(['', '  ', null, '7abc', '1e3'])(
    'rejects %j for an integer parameter',
    (value) => {
      const result = buildConfigSchema([days]).safeParse({ days: value });

      expect(result.success).toBe(false);
    },
  );

  it('reads a negative integer sent as text', () => {
    const result = buildConfigSchema([days]).safeParse({ days: '-2' });

    expect(result.data).toEqual({ days: -2 });
  });

  it('rejects an integer too large to be stored exactly', () => {
    const result = buildConfigSchema([days]).safeParse({
      days: '99999999999999999999',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty required string', () => {
    const result = buildConfigSchema([city]).safeParse({ city: '   ' });

    expect(result.success).toBe(false);
  });

  it('rejects a string longer than 500 characters', () => {
    const result = buildConfigSchema([city]).safeParse({
      city: 'a'.repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it('trims a string parameter', () => {
    const result = buildConfigSchema([city]).parse({ city: '  Paris ' });

    expect(result).toEqual({ city: 'Paris' });
  });

  it('rejects an unknown parameter', () => {
    const result = buildConfigSchema([city]).safeParse({
      city: 'Paris',
      admin: true,
    });

    expect(result.success).toBe(false);
  });

  it('leaves out an optional parameter that has no default', () => {
    const note: WidgetParam = { name: 'note', type: 'string', required: false };
    const result = buildConfigSchema([note]).parse({});

    expect(result).toEqual({});
  });
});
