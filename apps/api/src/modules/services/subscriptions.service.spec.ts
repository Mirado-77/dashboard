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

const weather = service({});
const github = service({ id: 'github', name: 'GitHub', providerType: 'oauth' });
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

function setup(rows: Row[] = [], linkedProviders: string[] = []) {
  const inserted: { credentials?: string | null }[] = [];
  let deletes = 0;

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: async () =>
          table === serviceSubscriptions
            ? rows
            : linkedProviders.map((id) => ({ id })),
      }),
    }),
    insert: () => ({
      values: (values: { credentials?: string | null }) => {
        inserted.push(values);
        return { onConflictDoUpdate: async () => undefined };
      },
    }),
    delete: () => ({
      where: async () => {
        deletes += 1;
      },
    }),
  } as unknown as Database;

  const subscriptions = new SubscriptionsService(
    db,
    new ServiceRegistry([weather, github, jira]),
    cipher,
  );
  return { subscriptions, inserted, deleted: () => deletes };
}

describe('SubscriptionsService', () => {
  it('lists every service and says which ones are subscribed', async () => {
    const { subscriptions } = setup([
      { serviceId: 'jira', credentials: cipher.encrypt({ apiToken: 'x' }) },
      { serviceId: 'weather', credentials: null },
    ]);

    const list = await subscriptions.list('user-1');

    expect(list.map((s) => [s.id, s.subscribed, s.hasCredentials])).toEqual([
      ['weather', true, false],
      ['github', false, false],
      ['jira', true, true],
    ]);
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

  it('stores no credentials for a service that needs none', async () => {
    const { subscriptions, inserted } = setup();

    const summary = await subscriptions.subscribe('user-1', 'weather', {});

    expect(summary.hasCredentials).toBe(false);
    expect(inserted[0].credentials).toBeNull();
  });

  it('refuses an oauth service while the provider is not linked', async () => {
    const { subscriptions, inserted } = setup();

    await expect(
      subscriptions.subscribe('user-1', 'github', {}),
    ).rejects.toThrow(/link your github account/i);
    expect(inserted).toHaveLength(0);
  });

  it('accepts an oauth service once the provider is linked', async () => {
    const { subscriptions, inserted } = setup([], ['github']);

    await subscriptions.subscribe('user-1', 'github', {});

    expect(inserted[0].credentials).toBeNull();
  });

  it('rejects an unknown service without touching the database', async () => {
    const { subscriptions, inserted, deleted } = setup();

    await expect(
      subscriptions.subscribe('user-1', 'pizza', {}),
    ).rejects.toThrow(/unknown service/i);
    await expect(subscriptions.unsubscribe('user-1', 'pizza')).rejects.toThrow(
      /unknown service/i,
    );
    expect(inserted).toHaveLength(0);
    expect(deleted()).toBe(0);
  });

  it('deletes the subscription, and its credentials with it', async () => {
    const { subscriptions, deleted } = setup();

    await subscriptions.unsubscribe('user-1', 'jira');

    expect(deleted()).toBe(1);
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
