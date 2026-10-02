import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Database } from '../../database/database.module.js';
import {
  serviceSubscriptions,
  widgetInstances,
} from '../../database/schema/index.js';
import { ServiceRegistry } from '../services/registry/registry.js';
import type { Service } from '../services/registry/types.js';
import { WidgetsService } from './widgets.service.js';

const weather: Service = {
  id: 'weather',
  name: 'Weather',
  description: 'Weather of any city',
  providerType: 'none',
  widgets: [
    {
      id: 'temperature',
      name: 'Temperature',
      description: 'Temperature of a city',
      params: [
        { name: 'city', type: 'string', required: true },
        { name: 'days', type: 'integer', required: false, defaultValue: 3 },
      ],
      defaultRefreshRate: 300,
      minRefreshRate: 60,
      getWidgetData: async () => null,
    },
  ],
};

interface State {
  subscribed?: boolean;
  /** Highest position among the user's widgets, null when there is none. */
  lastPosition?: number | null;
  /** Rows the user owns, as the filtered queries would return them. */
  owned?: Record<string, unknown>[];
}

function setup({ subscribed = true, lastPosition = null, owned = [] }: State) {
  const inserted: Record<string, unknown>[] = [];

  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === serviceSubscriptions) {
            return subscribed ? [{ id: 'sub-1' }] : [];
          }
          if (table === widgetInstances && fields && 'position' in fields) {
            return [{ position: lastPosition }];
          }
          return owned;
        },
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserted.push(values);
        return { returning: async () => [values] };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({ returning: async () => [{ ...owned[0], ...values }] }),
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        delete: () => ({
          where: () => ({ returning: async () => owned }),
        }),
        update: () => ({ set: () => ({ where: async () => undefined }) }),
      }),
  } as unknown as Database;

  return {
    widgets: new WidgetsService(db, new ServiceRegistry([weather])),
    inserted,
  };
}

const valid = {
  serviceId: 'weather',
  widgetId: 'temperature',
  config: { city: 'Paris' },
};

describe('WidgetsService.create', () => {
  it('puts the first widget at position 0 with the defaults', async () => {
    const { widgets, inserted } = setup({});

    await widgets.create('user-1', valid);

    expect(inserted[0]).toMatchObject({
      userId: 'user-1',
      subscriptionId: 'sub-1',
      config: { city: 'Paris', days: 3 },
      refreshRate: 300,
      position: 0,
    });
  });

  it('puts a new widget after the last one', async () => {
    const { widgets, inserted } = setup({ lastPosition: 4 });

    await widgets.create('user-1', valid);

    expect(inserted[0].position).toBe(5);
  });

  it('rejects a malformed body', async () => {
    const { widgets } = setup({});

    await expect(widgets.create('user-1', { serviceId: 42 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown widget', async () => {
    const { widgets } = setup({});

    await expect(
      widgets.create('user-1', { ...valid, widgetId: 'nope' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a widget of a service the user is not subscribed to', async () => {
    const { widgets, inserted } = setup({ subscribed: false });

    await expect(widgets.create('user-1', valid)).rejects.toThrow(
      BadRequestException,
    );
    expect(inserted).toHaveLength(0);
  });
});

describe('WidgetsService.update', () => {
  const row = {
    id: 'w-1',
    serviceId: 'weather',
    widgetId: 'temperature',
    config: { city: 'Paris', days: 3 },
    refreshRate: 300,
  };

  it('keeps what is not sent', async () => {
    const { widgets } = setup({ owned: [row] });

    const updated = await widgets.update('user-1', 'w-1', { refreshRate: 600 });

    expect(updated).toMatchObject({ config: row.config, refreshRate: 600 });
  });

  it('answers 404 for a widget the user does not own', async () => {
    const { widgets } = setup({ owned: [] });

    await expect(
      widgets.update('user-1', 'w-1', { refreshRate: 600 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('WidgetsService.remove', () => {
  it('answers 404 for a widget the user does not own', async () => {
    const { widgets } = setup({ owned: [] });

    await expect(widgets.remove('user-1', 'w-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
