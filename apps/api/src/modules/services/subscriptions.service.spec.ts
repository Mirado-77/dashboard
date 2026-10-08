import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import type { Database } from '../../database/database.module.js';
import { serviceSubscriptions } from '../../database/schema/index.js';
import { CredentialsCipher } from './credentials.service.js';
import { ServiceRegistry } from './registry/registry.js';
import type { Service } from './registry/types.js';
import { SubscriptionsService } from './subscriptions.service.js';

const cipher = new CredentialsCipher({
  get: () => 'test-secret-test-secret-test-secret',
} as unknown as ConfigService<Env, true>);

function service(overrides: Partial<Service>): Service {
  return {
    id: 'weather',
    name: 'Weather',
    description: 'Weather of any city',
    providerType: 'none',
    widgets: [],
    ...overrides,
  };
}

const weather = service({
  widgets: [
    {
      id: 'forecast',
      name: 'Forecast',
      description: 'Forecast of a city',
      params: [{ name: 'city', type: 'string', required: true }],
      defaultRefreshRate: 1800,
      minRefreshRate: 300,
      getWidgetData: async () => null,
    },
  ],
});
const github = service({
  id: 'github',
  name: 'GitHub',
  providerType: 'oauth',
  oauthScopes: ['repo:status'],
});
const jira = service({
  id: 'jira',
  name: 'Jira',
  providerType: 'credentials',
  credentialFields: [{ name: 'apiToken', label: 'API token', secret: true }],
});

interface Row {
  serviceId: string;
  credentials: string | null;
}

/** Linked accounts, by provider, with the scopes they granted. */
type Linked = Record<string, string>;

function setup(rows: Row[] = [], linked: Linked = {}) {
  const inserted: { credentials?: string | null }[] = [];
  const deletedFrom: unknown[] = [];

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: async () =>
          table === serviceSubscriptions
            ? rows
            : Object.entries(linked).map(([providerId, scope]) => ({
                providerId,
                scope,
              })),
      }),
    }),
    insert: () => ({
      values: (values: { credentials?: string | null }) => {
        inserted.push(values);
        return { onConflictDoUpdate: async () => undefined };
      },
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletedFrom.push(table);
      },
    }),
  } as unknown as Database;

  const subscriptions = new SubscriptionsService(
    db,
    new ServiceRegistry([weather, github, jira]),
    cipher,
  );
  return { subscriptions, inserted, deletedFrom };
}

describe('SubscriptionsService', () => {
  it('lists every service and says which ones are subscribed', async () => {
    const { subscriptions } = setup([
      { serviceId: 'jira', credentials: cipher.encrypt({ apiToken: 'x' }) },
    ]);

    const list = await subscriptions.list('user-1');

    expect(
      list.map((s) => [s.id, s.subscribed, s.available, s.hasCredentials]),
    ).toEqual([
      ['weather', false, true, false],
      ['github', false, false, false],
      ['jira', true, true, true],
    ]);
  });

  it('makes a service without account available by default', async () => {
    // A subscription left from before the service became available by default.
    const { subscriptions } = setup([
      { serviceId: 'weather', credentials: null },
    ]);

    const [weatherSummary] = await subscriptions.list('user-1');

    expect(weatherSummary).toMatchObject({
      subscribed: false,
      available: true,
    });
  });

  it('says whether the linked account granted the scopes of a service', async () => {
    const granted = await setup([], {
      github: 'read:user,repo:status',
    }).subscriptions.list('user-1');
    const missing = await setup([], { github: 'read:user' }).subscriptions.list(
      'user-1',
    );
    const unlinked = await setup().subscriptions.list('user-1');

    expect(
      [granted, missing, unlinked].map((list) => list[1].accessGranted),
    ).toEqual([true, false, false]);
  });

  it('never exposes the stored credentials', async () => {
    const { subscriptions } = setup([
      {
        serviceId: 'jira',
        credentials: cipher.encrypt({ apiToken: 'super-secret' }),
      },
    ]);

    expect(JSON.stringify(await subscriptions.list('user-1'))).not.toContain(
      'super-secret',
    );
  });

  it('encrypts the credentials before storing them', async () => {
    const { subscriptions, inserted } = setup();

    const summary = await subscriptions.subscribe('user-1', 'jira', {
      apiToken: 'super-secret',
    });

    expect(summary.hasCredentials).toBe(true);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].credentials).not.toContain('super-secret');
    expect(cipher.decrypt(inserted[0].credentials as string)).toEqual({
      apiToken: 'super-secret',
    });
  });

  it('refuses to subscribe to or unsubscribe from a service available by default', async () => {
    const { subscriptions, inserted, deletedFrom } = setup();

    await expect(
      subscriptions.subscribe('user-1', 'weather', {}),
    ).rejects.toMatchObject({
      response: { code: 'NO_SUBSCRIPTION_NEEDED' },
    });
    await expect(
      subscriptions.unsubscribe('user-1', 'weather'),
    ).rejects.toMatchObject({
      response: { code: 'NO_SUBSCRIPTION_NEEDED' },
    });
    expect(inserted).toHaveLength(0);
    expect(deletedFrom).toHaveLength(0);
  });

  it('refuses an oauth service while the provider is not linked', async () => {
    const { subscriptions, inserted } = setup();

    await expect(
      subscriptions.subscribe('user-1', 'github', {}),
    ).rejects.toThrow(/link your github account/i);
    expect(inserted).toHaveLength(0);
  });

  it('accepts an oauth service once the provider is linked', async () => {
    const { subscriptions, inserted } = setup([], {
      github: 'read:user,repo:status',
    });

    await subscriptions.subscribe('user-1', 'github', {});

    expect(inserted[0].credentials).toBeNull();
  });

  it('rejects an unknown service without touching the database', async () => {
    const { subscriptions, inserted, deletedFrom } = setup();

    await expect(
      subscriptions.subscribe('user-1', 'pizza', {}),
    ).rejects.toThrow(/unknown service/i);
    await expect(subscriptions.unsubscribe('user-1', 'pizza')).rejects.toThrow(
      /unknown service/i,
    );
    expect(inserted).toHaveLength(0);
    expect(deletedFrom).toHaveLength(0);
  });

  it('deletes the subscription, and its credentials with it', async () => {
    const { subscriptions, deletedFrom } = setup();

    await subscriptions.unsubscribe('user-1', 'jira');

    expect(deletedFrom).toEqual([serviceSubscriptions]);
  });

  it('lists the widgets of each service, without their code', async () => {
    const { subscriptions } = setup();

    const [summary] = await subscriptions.list('user-1');

    expect(summary.widgets).toEqual([
      {
        id: 'forecast',
        name: 'Forecast',
        description: 'Forecast of a city',
        params: [{ name: 'city', type: 'string', required: true }],
        defaultRefreshRate: 1800,
        minRefreshRate: 300,
      },
    ]);
    expect(JSON.stringify(summary)).not.toContain('getWidgetData');
  });

  it('decrypts the credentials for the widgets only', async () => {
    const { subscriptions } = setup([
      {
        serviceId: 'jira',
        credentials: cipher.encrypt({ apiToken: 'super-secret' }),
      },
    ]);

    expect(await subscriptions.credentialsOf('user-1', 'jira')).toEqual({
      apiToken: 'super-secret',
    });
  });
});
