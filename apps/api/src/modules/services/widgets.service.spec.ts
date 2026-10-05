import { Logger } from '@nestjs/common';
import type { Database } from '../../database/database.module.js';
import { WidgetDataError } from './registry/errors.js';
import { ServiceRegistry } from './registry/registry.js';
import type { Service, WidgetContext } from './registry/types.js';
import type { SubscriptionsService } from './subscriptions.service.js';
import { WidgetsService } from './widgets.service.js';

interface Row {
  id: string;
  userId: string;
  serviceId: string;
  widgetId: string;
  config: Record<string, string | number>;
  refreshRate: number;
  position: number;
}

function row(overrides: Partial<Row>): Row {
  return {
    id: 'instance-1',
    userId: 'user-1',
    serviceId: 'weather',
    widgetId: 'forecast',
    config: { city: 'Paris', days: 3 },
    refreshRate: 1800,
    position: 0,
    ...overrides,
  };
}

/**
 * fake database ignores `where`: `found` answers a lookup by id, `rows`
 * answers the ordered list of the dashboard.
 */

function setup(
  options: {
    rows?: Row[];
    found?: Row;
    subscribed?: boolean;
    getWidgetData?: (ctx: WidgetContext) => Promise<unknown>;
  } = {},
) {
  const rows = options.rows ?? [];
  const inserted: Row[] = [];
  const updated: Partial<Row>[] = [];
  let deletes = 0;

  const weather: Service = {
    id: 'weather',
    name: 'Weather',
    description: 'Weather of any city',
    providerType: 'none',
    widgets: [
      {
        id: 'forecast',
        name: 'Forecast',
        description: 'Forecast of a city',
        params: [
          { name: 'city', type: 'string', required: true },
          { name: 'days', type: 'integer', required: false, defaultValue: 3 },
        ],
        defaultRefreshRate: 1800,
        minRefreshRate: 300,
        getWidgetData:
          options.getWidgetData ?? (async ({ config }) => ({ for: config })),
      },
    ],
  };

  const db = {
    select: () => ({
      from: () => ({
        where: () =>
          Object.assign(Promise.resolve(options.found ? [options.found] : []), {
            orderBy: async () => rows,
          }),
      }),
    }),
    insert: () => ({
      values: async (values: Row) => {
        inserted.push(values);
      },
    }),
    update: () => ({
      set: (values: Partial<Row>) => ({
        where: async () => {
          updated.push(values);
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        deletes += 1;
      },
    }),
    transaction: (run: (tx: Database) => Promise<void>) => run(db),
  } as unknown as Database;

  const widgets = new WidgetsService(db, new ServiceRegistry([weather]), {
    isSubscribed: async () => options.subscribed ?? true,
  } as unknown as SubscriptionsService);
  return { widgets, inserted, updated, deleted: () => deletes };
}

describe('WidgetsService', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('lists the dashboard without saying whose it is', async () => {
    const { widgets } = setup({ rows: [row({})] });

    expect(await widgets.list('user-1')).toEqual([
      {
        id: 'instance-1',
        serviceId: 'weather',
        widgetId: 'forecast',
        config: { city: 'Paris', days: 3 },
        refreshRate: 1800,
        position: 0,
      },
    ]);
  });

  it('adds a widget at the end, with its defaults', async () => {
    const { widgets, inserted } = setup({
      rows: [row({}), row({ id: 'instance-2', position: 1 })],
    });

    const instance = await widgets.create('user-1', {
      serviceId: 'weather',
      widgetId: 'forecast',
      config: { city: 'Lyon' },
    });

    expect(instance).toMatchObject({
      config: { city: 'Lyon', days: 3 },
      refreshRate: 1800,
      position: 2,
    });
    expect(inserted).toEqual([{ ...instance, userId: 'user-1' }]);
  });

  it('refuses an unknown widget', async () => {
    const { widgets, inserted } = setup();

    await expect(
      widgets.create('user-1', { serviceId: 'weather', widgetId: 'tides' }),
    ).rejects.toThrow(/unknown widget/i);
    expect(inserted).toHaveLength(0);
  });

  it('refuses a widget of a service the user is not subscribed to', async () => {
    const { widgets, inserted } = setup({ subscribed: false });

    await expect(
      widgets.create('user-1', {
        serviceId: 'weather',
        widgetId: 'forecast',
        config: { city: 'Lyon' },
      }),
    ).rejects.toThrow(/subscribe to weather first/i);
    expect(inserted).toHaveLength(0);
  });

  it('refuses an invalid config or a refresh rate below the minimum', async () => {
    const { widgets, inserted } = setup();
    const ids = { serviceId: 'weather', widgetId: 'forecast' };

    await expect(widgets.create('user-1', ids)).rejects.toThrow(/expects/i);
    await expect(
      widgets.create('user-1', {
        ...ids,
        config: { city: 'Lyon' },
        refreshRate: 10,
      }),
    ).rejects.toThrow(/300 seconds/);
    expect(inserted).toHaveLength(0);
  });

  it('updates the config and keeps the rest', async () => {
    const current = row({});
    const { widgets, updated } = setup({ rows: [current], found: current });

    const instance = await widgets.update('user-1', 'instance-1', {
      config: { city: 'Lyon', days: 5 },
    });

    expect(instance).toMatchObject({
      config: { city: 'Lyon', days: 5 },
      refreshRate: 1800,
      position: 0,
    });
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ config: { city: 'Lyon', days: 5 } });
  });

  it('moves a widget and renumbers the ones it went past', async () => {
    const rows = ['a', 'b', 'c', 'd'].map((id, position) =>
      row({ id, position }),
    );
    const { widgets, updated } = setup({ rows, found: rows[3] });

    const instance = await widgets.update('user-1', 'd', { position: 1 });

    expect(instance.position).toBe(1);
    // b and c shift down, a does not move, then d itself.
    expect(updated.map((values) => values.position)).toEqual([2, 3, 1]);
  });

  it('never touches the widget of someone else', async () => {
    const { widgets, updated, deleted } = setup({ rows: [row({})] });

    await expect(
      widgets.update('user-2', 'instance-1', { refreshRate: 600 }),
    ).rejects.toThrow(/unknown widget instance/i);
    await expect(widgets.remove('user-2', 'instance-1')).rejects.toThrow(
      /unknown widget instance/i,
    );
    await expect(widgets.data('user-2', 'instance-1')).rejects.toThrow(
      /unknown widget instance/i,
    );
    expect(updated).toHaveLength(0);
    expect(deleted()).toBe(0);
  });

  it('removes a widget', async () => {
    const { widgets, deleted } = setup({ found: row({}) });

    await widgets.remove('user-1', 'instance-1');

    expect(deleted()).toBe(1);
  });

  it('fetches the data of a widget with its stored config', async () => {
    const { widgets } = setup({ found: row({}) });

    expect(await widgets.data('user-1', 'instance-1')).toEqual({
      data: { for: { city: 'Paris', days: 3 } },
    });
  });

  it('answers 502 with the reason when the third party fails', async () => {
    const { widgets } = setup({
      found: row({}),
      getWidgetData: async () => {
        throw new WidgetDataError('Unknown city: Paris');
      },
    });

    await expect(widgets.data('user-1', 'instance-1')).rejects.toMatchObject({
      status: 502,
      response: {
        code: 'WIDGET_DATA_UNAVAILABLE',
        message: 'Unknown city: Paris',
      },
    });
  });

  it('hides the details of an unexpected failure', async () => {
    const { widgets } = setup({
      found: row({}),
      getWidgetData: async () => {
        throw new TypeError('fetch failed: 10.0.0.1 refused');
      },
    });

    await expect(widgets.data('user-1', 'instance-1')).rejects.toMatchObject({
      status: 502,
      response: { message: 'The service could not be reached' },
    });
  });

  it('refuses to fetch with a stored config the widget no longer accepts', async () => {
    const { widgets } = setup({ found: row({ config: { town: 'Paris' } }) });

    await expect(widgets.data('user-1', 'instance-1')).rejects.toThrow(
      /expects/i,
    );
  });
});
