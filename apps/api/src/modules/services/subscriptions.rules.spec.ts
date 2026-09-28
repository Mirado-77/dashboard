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
    expect(credentialsToStore(free, undefined, false)).toBeNull();
    expect(credentialsToStore(free, { any: 'thing' }, false)).toBeNull();
  });

  it('stores nothing for an oauth service, the token stays in account', () => {
    expect(credentialsToStore(github, undefined, true)).toBeNull();
  });

  it('refuses an oauth service when the provider is not linked', () => {
    expect(() => credentialsToStore(github, undefined, false)).toThrow(
      /link your github account/i,
    );
  });

  it('keeps the declared fields of a credentials service', () => {
    const credentials = credentialsToStore(
      jira,
      { email: ' rick@citadel.io ', apiToken: 'secret-token' },
      false,
    );

    expect(credentials).toEqual({
      email: 'rick@citadel.io',
      apiToken: 'secret-token',
    });
  });

  it('refuses a missing, empty or unknown field', () => {
    expect(() =>
      credentialsToStore(jira, { email: 'rick@citadel.io' }, false),
    ).toThrow();
    expect(() =>
      credentialsToStore(
        jira,
        { email: '  ', apiToken: 'secret-token' },
        false,
      ),
    ).toThrow();
    expect(() =>
      credentialsToStore(
        jira,
        { email: 'rick@citadel.io', apiToken: 'secret-token', role: 'admin' },
        false,
      ),
    ).toThrow();
  });

  it('names the expected fields without echoing what was sent', () => {
    try {
      credentialsToStore(jira, { apiToken: 'secret-token' }, false);
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
