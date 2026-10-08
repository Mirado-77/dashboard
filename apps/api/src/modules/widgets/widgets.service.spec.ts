import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { Database } from '../../database/database.module.js';
import { serviceSubscriptions } from '../../database/schema/index.js';
import type { ProviderTokens } from '../services/provider-tokens.service.js';
import { WidgetDataError } from '../services/registry/errors.js';
import { ServiceRegistry } from '../services/registry/registry.js';
import type { Service, WidgetContext } from '../services/registry/types.js';
import { Errors } from '../auth/custom/errors.js';
import { WidgetsService } from './widgets.service.js';

let getWidgetData: (ctx: WidgetContext) => Promise<unknown>;

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
      getWidgetData: (ctx) => getWidgetData(ctx),
    },
  ],
};

const github: Service = {
  id: 'github',
  name: 'GitHub',
  description: 'Your repositories',
  providerType: 'oauth',
  widgets: [
    {
      id: 'me',
      name: 'Me',
      description: 'Who the token belongs to',
      params: [],
      defaultRefreshRate: 300,
      minRefreshRate: 60,
      getWidgetData: (ctx) => getWidgetData(ctx),
    },
  ],
};

beforeAll(() => Logger.overrideLogger(false));
beforeEach(() => {
  getWidgetData = async ({ config }) => ({ for: config });
});

interface State {
  subscribed?: boolean;
  /** Highest position among the user's widgets, null when there is none. */
  lastPosition?: number | null;
  /** Rows the user owns, as the filtered queries would return them. */
  owned?: Record<string, unknown>[];
  /** The whole dashboard in order, when it differs from `owned`. */
  ordered?: Record<string, unknown>[];
  /** Access token of the linked account, null when it is not linked. */
  token?: string | null;
  /** Thrown when the token is asked for, e.g. a refused refresh. */
  tokenError?: Error;
}

function setup({
  subscribed = true,
  lastPosition = null,
  owned = [],
  ordered = owned,
  token = null,
  tokenError,
}: State) {
  const inserted: Record<string, unknown>[] = [];
  /** Every `set` sent to the widget table, in order. */
  const updates: Record<string, unknown>[] = [];

  const update = () => ({
    set: (values: Record<string, unknown>) => ({
      where: () => {
        updates.push(values);
        return Object.assign(Promise.resolve(), {
          returning: async () => [{ ...owned[0], ...values }],
        });
      },
    }),
  });

  const select = (fields?: Record<string, unknown>) => ({
    from: (table: unknown) => ({
      where: () => {
        const rows =
          table === serviceSubscriptions
            ? subscribed
              ? [{ id: 'sub-1' }]
              : []
            : fields && 'position' in fields
              ? [{ position: lastPosition }]
              : owned;
        return Object.assign(Promise.resolve(rows), {
          orderBy: async () => ordered,
        });
      },
    }),
  });

  const db = {
    select,
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserted.push(values);
        return { returning: async () => [values] };
      },
    }),
    update,
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        select,
        update,
        delete: () => ({
          where: () => ({ returning: async () => owned }),
        }),
      }),
  } as unknown as Database;

  const tokenCalls: unknown[][] = [];
  const tokens = {
    forService: async (...args: unknown[]) => {
      tokenCalls.push(args);
      if (tokenError) throw tokenError;
      return token ? { accessToken: token, expiresAt: null, scopes: [] } : null;
    },
  } as unknown as ProviderTokens;

  return {
    widgets: new WidgetsService(
      db,
      new ServiceRegistry([weather, github]),
      tokens,
    ),
    tokenCalls,
    inserted,
    updates,
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

  it('needs no subscription for a service available by default', async () => {
    const { widgets, inserted } = setup({ subscribed: false });

    await widgets.create('user-1', valid);

    expect(inserted[0].subscriptionId).toBeNull();
  });

  it('ties a widget to the subscription of its service', async () => {
    const { widgets, inserted } = setup({});

    await widgets.create('user-1', {
      serviceId: 'github',
      widgetId: 'me',
      config: {},
    });

    expect(inserted[0].subscriptionId).toBe('sub-1');
  });

  it('rejects a widget of a service the user is not subscribed to', async () => {
    const { widgets, inserted } = setup({ subscribed: false });

    await expect(
      widgets.create('user-1', {
        serviceId: 'github',
        widgetId: 'me',
        config: {},
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'NOT_SUBSCRIBED' },
    });
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

  it('moves a widget and renumbers only the ones it went past', async () => {
    const owned = ['a', 'b', 'c', 'd'].map((id, position) => ({
      ...row,
      id,
      position,
    }));
    const { widgets, updates } = setup({ owned: [owned[3]], ordered: owned });

    await widgets.update('user-1', 'd', { position: 1 });

    // b and c shift down, a stays, then d itself lands at 1.
    expect(updates.map((values) => values.position)).toEqual([2, 3, 1]);
  });

  it('rejects a negative position', async () => {
    const { widgets, updates } = setup({ owned: [row] });

    await expect(
      widgets.update('user-1', 'w-1', { position: -1 }),
    ).rejects.toThrow(BadRequestException);
    expect(updates).toHaveLength(0);
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

describe('WidgetsService.data', () => {
  const row = {
    id: 'w-1',
    serviceId: 'weather',
    widgetId: 'temperature',
    config: { city: 'Paris', days: 3 },
    refreshRate: 300,
  };

  it('fetches the data with the stored config', async () => {
    const { widgets } = setup({ owned: [row] });

    expect(await widgets.data('user-1', 'w-1')).toEqual({
      data: { for: { city: 'Paris', days: 3 } },
    });
  });

  it('answers 404 for a widget the user does not own', async () => {
    const { widgets } = setup({ owned: [] });

    await expect(widgets.data('user-1', 'w-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('answers 502 with the reason when the third party fails', async () => {
    getWidgetData = async () => {
      throw new WidgetDataError('Unknown city: Paris');
    };
    const { widgets } = setup({ owned: [row] });

    await expect(widgets.data('user-1', 'w-1')).rejects.toMatchObject({
      status: 502,
      response: {
        code: 'WIDGET_DATA_UNAVAILABLE',
        message: 'Unknown city: Paris',
      },
    });
  });

  it('hides the details of an unexpected failure', async () => {
    getWidgetData = async () => {
      throw new TypeError('fetch failed: 10.0.0.1 refused');
    };
    const { widgets } = setup({ owned: [row] });

    await expect(widgets.data('user-1', 'w-1')).rejects.toMatchObject({
      status: 502,
      response: { message: 'The service could not be reached' },
    });
  });

  it('refuses a stored config the widget no longer accepts', async () => {
    const { widgets } = setup({
      owned: [{ ...row, config: { town: 'Paris' } }],
    });

    await expect(widgets.data('user-1', 'w-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  const linked = {
    id: 'w-2',
    serviceId: 'github',
    widgetId: 'me',
    config: {},
    refreshRate: 300,
  };

  it('gives the access token of the user to an oauth widget', async () => {
    getWidgetData = async ({ accessToken }) => ({ calledWith: accessToken });
    const { widgets, tokenCalls } = setup({
      owned: [linked],
      token: 'gh-token',
    });

    expect(await widgets.data('user-1', 'w-2')).toEqual({
      data: { calledWith: 'gh-token' },
    });
    expect(tokenCalls).toEqual([['user-1', github]]);
  });

  it('asks to link the account when there is no token', async () => {
    let called = false;
    getWidgetData = async () => {
      called = true;
    };
    const { widgets } = setup({ owned: [linked] });

    await expect(widgets.data('user-1', 'w-2')).rejects.toMatchObject({
      status: 400,
      response: { code: 'PROVIDER_NOT_LINKED' },
    });
    expect(called).toBe(false);
  });

  it('asks to reconnect the account when its token cannot be refreshed', async () => {
    const { widgets } = setup({
      owned: [linked],
      tokenError: Errors.providerReauthRequired('github'),
    });

    await expect(widgets.data('user-1', 'w-2')).rejects.toMatchObject({
      status: 401,
      response: {
        code: 'PROVIDER_REAUTH_REQUIRED',
        message: 'Reconnect your github account',
      },
    });
  });

  it('lets any other token failure through', async () => {
    const failure = new Error('database down');
    const { widgets } = setup({ owned: [linked], tokenError: failure });

    await expect(widgets.data('user-1', 'w-2')).rejects.toBe(failure);
  });

  it('asks for no token for a service without account', async () => {
    getWidgetData = async (ctx) => ({ keys: Object.keys(ctx) });
    const { widgets, tokenCalls } = setup({ owned: [row], token: 'gh-token' });

    expect(await widgets.data('user-1', 'w-1')).toEqual({
      data: { keys: ['config'] },
    });
    expect(tokenCalls).toHaveLength(0);
  });
});
