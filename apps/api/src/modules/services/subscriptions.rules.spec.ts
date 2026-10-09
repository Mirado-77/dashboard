import type { Service } from './registry/types.js';
import { credentialsToStore, providerOf } from './subscriptions.rules.js';

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

const free = service({});
const github = service({ id: 'github', name: 'GitHub', providerType: 'oauth' });
const jira = service({
  id: 'jira',
  name: 'Jira',
  providerType: 'credentials',
  credentialFields: [
    { name: 'email', label: 'Email', secret: false },
    { name: 'apiToken', label: 'API token', secret: true },
  ],
});

describe('credentialsToStore', () => {
  it('stores nothing for a service that needs no account', () => {
    expect(credentialsToStore(free, undefined, null)).toBeNull();
    expect(credentialsToStore(free, { any: 'thing' }, null)).toBeNull();
  });

  it('stores nothing for an oauth service, the token stays in account', () => {
    expect(credentialsToStore(github, undefined, [])).toBeNull();
  });

  it('refuses an oauth service when the provider is not linked', () => {
    expect(() => credentialsToStore(github, undefined, null)).toThrow(
      /link your github account/i,
    );
  });

  describe('with scopes to grant', () => {
    const calendar = service({
      id: 'google-calendar',
      name: 'Google Calendar',
      providerType: 'oauth',
      oauthProviderId: 'google',
      oauthScopes: ['calendar.readonly'],
    });

    it('refuses a linked account that did not grant them', () => {
      expect(() =>
        credentialsToStore(calendar, undefined, ['openid', 'email']),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: 'PROVIDER_SCOPE_MISSING',
          }),
        }),
      );
    });

    it('accepts a linked account that granted them', () => {
      expect(
        credentialsToStore(calendar, undefined, [
          'openid',
          'calendar.readonly',
        ]),
      ).toBeNull();
    });
  });

  it('keeps the declared fields of a credentials service', () => {
    const credentials = credentialsToStore(
      jira,
      { email: ' rick@citadel.io ', apiToken: 'secret-token' },
      null,
    );

    expect(credentials).toEqual({
      email: 'rick@citadel.io',
      apiToken: 'secret-token',
    });
  });

  it('refuses a missing, empty or unknown field', () => {
    expect(() =>
      credentialsToStore(jira, { email: 'rick@citadel.io' }, null),
    ).toThrow();
    expect(() =>
      credentialsToStore(jira, { email: '  ', apiToken: 'secret-token' }, null),
    ).toThrow();
    expect(() =>
      credentialsToStore(
        jira,
        { email: 'rick@citadel.io', apiToken: 'secret-token', role: 'admin' },
        null,
      ),
    ).toThrow();
  });

  it('names the expected fields without echoing what was sent', () => {
    try {
      credentialsToStore(jira, { apiToken: 'secret-token' }, null);
      throw new Error('should have thrown');
    } catch (error) {
      const message = JSON.stringify(
        (error as { response?: unknown }).response,
      );
      expect(message).toContain('apiToken');
      expect(message).not.toContain('secret-token');
    }
  });
});

describe('providerOf', () => {
  it('uses the service id by default', () => {
    expect(providerOf(github)).toBe('github');
  });

  it('uses the declared provider when the ids differ', () => {
    expect(
      providerOf(service({ id: 'agenda', oauthProviderId: 'google' })),
    ).toBe('google');
  });
});
