import type { AuthInstance } from '../auth.contract.js';
import { createAuth } from './create-auth.js';
import type {
  OAuthProvider,
  OAuthTokens,
  OAuthUserInfo,
} from './oauth/provider.js';
import type { AuthOptions } from './options.js';
import { github } from './oauth/providers/github.js';
import { memoryStore } from './store/memory.js';
import type { AuthStore } from './store/store.js';

const ORIGIN = 'http://localhost:8081';
const BASE = `${ORIGIN}/api/auth`;

function fakeProvider(overrides: Partial<OAuthProvider> = {}) {
  const identities = new Map<string, OAuthUserInfo>();
  const calls = { refresh: 0 };
  let expiresIn: number | null = 3600;
  const tokens = (code: string): OAuthTokens => ({
    accessToken: `access-${code}`,
    refreshToken: `refresh-${code}`,
    idToken: null,
    accessTokenExpiresAt:
      expiresIn === null ? null : new Date(Date.now() + expiresIn * 1000),
    refreshTokenExpiresAt: null,
    scopes: ['read'],
  });
  const provider: OAuthProvider = {
    id: 'fake',
    name: 'Fake',
    createAuthorizationURL: ({ state }) =>
      new URL(`https://fake.test/authorize?state=${state}`),
    validateAuthorizationCode: async ({ code }) => tokens(code),
    getUserInfo: async ({ accessToken }) =>
      identities.get(accessToken.replace('access-', ''))!,
    refreshAccessToken: async () => {
      calls.refresh++;
      await new Promise((r) => setTimeout(r, 10));
      return { ...tokens('refreshed'), refreshToken: null };
    },
    ...overrides,
  };
  return {
    provider,
    calls,
    identity: (code: string, info: Partial<OAuthUserInfo> = {}) =>
      identities.set(code, {
        id: `id-${code}`,
        email: `${code}@fake.test`,
        emailVerified: true,
        name: code,
        image: null,
        ...info,
      }),
    setExpiresIn: (seconds: number | null) => (expiresIn = seconds),
  };
}

function setup(extra: Partial<AuthOptions> = {}) {
  const store = memoryStore();
  const fake = fakeProvider();
  const mails: string[] = [];
  const auth = createAuth({
    baseURL: BASE,
    secret: 'test-secret-test-secret-test-secret',
    trustedOrigins: [ORIGIN],
    store,
    socialProviders: [fake.provider],
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      sendOnSignUp: true,
      async sendVerificationEmail({ url }) {
        mails.push(url);
      },
    },
    rateLimit: { enabled: false, window: 60, max: 100 },
    logger: { error: () => {}, warn: () => {} },
    ...extra,
  });
  return { auth, store, fake, mails };
}

const cookieValue = (response: Response, name: string) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith(`${name}=`) && c !== `${name}=`) ?? null;

function post(
  auth: AuthInstance,
  path: string,
  body: unknown,
  cookie?: string,
) {
  return auth.handler(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

/** Runs the whole redirect dance and returns the callback response. */
async function oauthFlow(
  auth: AuthInstance,
  code: string,
  options: { path?: string; session?: string; body?: object } = {},
) {
  const start = await post(
    auth,
    options.path ?? '/sign-in/social',
    { provider: 'fake', callbackURL: '/dashboard', ...options.body },
    options.session,
  );
  const { url } = await start.json();
  const state = new URL(url).searchParams.get('state')!;
  const stateCookie = cookieValue(start, 'dashboard.oauth_state')!;
  const cookie = [stateCookie, options.session].filter(Boolean).join('; ');
  const callback = await auth.handler(
    new Request(`${BASE}/callback/fake?code=${code}&state=${state}`, {
      headers: { cookie },
    }),
  );
  return { start, callback, state, stateCookie };
}

async function credentialUser(
  auth: AuthInstance,
  email: string,
  verify: boolean,
  mails: string[],
) {
  await post(auth, '/sign-up/email', {
    name: 'Local',
    email,
    password: 'password123',
  });
  if (!verify) return null;
  await auth.handler(new Request(mails.at(-1)!));
  const signIn = await post(auth, '/sign-in/email', {
    email,
    password: 'password123',
  });
  return cookieValue(signIn, 'dashboard.session_token');
}

describe('OAuth', () => {
  it('lists providers', async () => {
    const { auth } = setup();
    const response = await auth.handler(new Request(`${BASE}/providers`));
    expect(await response.json()).toEqual([
      { id: 'fake', name: 'Fake', signIn: true },
    ]);
  });

  it('creates a user on first sign in and stores encrypted tokens', async () => {
    const { auth, store, fake } = setup();
    fake.identity('rick');
    const { start, callback } = await oauthFlow(auth, 'rick');

    expect(start.status).toBe(200);
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('/dashboard');
    const session = cookieValue(callback, 'dashboard.session_token');
    expect(session).not.toBeNull();

    const user = await store.users.findByEmail('rick@fake.test');
    expect(user?.emailVerified).toBe(true);
    const account = await store.accounts.findByProvider('fake', 'id-rick');
    expect(account?.accessToken).not.toContain('access-rick');
    expect(
      await auth.api.getAccessToken({ userId: user!.id, providerId: 'fake' }),
    ).toMatchObject({
      accessToken: 'access-rick',
      scopes: ['read'],
    });
  });

  it('rejects a callback without the state cookie and replayed states', async () => {
    const { auth, fake } = setup();
    fake.identity('rick');
    const { state, stateCookie } = await oauthFlow(auth, 'rick');

    const replay = await auth.handler(
      new Request(`${BASE}/callback/fake?code=rick&state=${state}`, {
        headers: { cookie: stateCookie },
      }),
    );
    expect(replay.headers.get('location')).toBe('/?error=STATE_MISMATCH');

    const start = await post(auth, '/sign-in/social', {
      provider: 'fake',
      callbackURL: '/dashboard',
    });
    const fresh = new URL((await start.json()).url).searchParams.get('state');
    const noCookie = await auth.handler(
      new Request(`${BASE}/callback/fake?code=rick&state=${fresh}`),
    );
    expect(noCookie.headers.get('location')).toBe('/?error=STATE_MISMATCH');
  });

  it('links to an existing user when the provider verified the email', async () => {
    const { auth, store, fake, mails } = setup();
    await credentialUser(auth, 'morty@fake.test', true, mails);
    fake.identity('morty');

    const { callback } = await oauthFlow(auth, 'morty');
    expect(callback.headers.get('location')).toBe('/dashboard');
    const user = await store.users.findByEmail('morty@fake.test');
    expect(
      (await store.accounts.listByUser(user!.id))
        .map((a) => a.providerId)
        .sort(),
    ).toEqual(['credential', 'fake']);
  });

  it('refuses to link when the provider email is not verified', async () => {
    const { auth, fake, mails } = setup();
    await credentialUser(auth, 'morty@fake.test', true, mails);
    fake.identity('morty', { emailVerified: false });

    const { callback } = await oauthFlow(auth, 'morty', {
      body: { errorCallbackURL: '/sign-in' },
    });
    expect(callback.headers.get('location')).toBe(
      '/sign-in?error=ACCOUNT_NOT_LINKED',
    );
  });

  it('removes the password of an unverified squatting account', async () => {
    const { auth, store, fake, mails } = setup();
    await credentialUser(auth, 'summer@fake.test', false, mails);
    fake.identity('summer');

    const { callback } = await oauthFlow(auth, 'summer');
    expect(callback.headers.get('location')).toBe('/dashboard');
    const user = await store.users.findByEmail('summer@fake.test');
    expect(user?.emailVerified).toBe(true);
    expect(await store.accounts.findByUser(user!.id, 'credential')).toBeNull();
  });

  it('links a provider to the signed in user and refuses accounts owned by others', async () => {
    const { auth, store, fake, mails } = setup();
    const session = (await credentialUser(
      auth,
      'beth@citadel.io',
      true,
      mails,
    ))!;
    fake.identity('beth-github', { email: 'other@fake.test' });

    const anonymous = await post(auth, '/link-social', { provider: 'fake' });
    expect(anonymous.status).toBe(401);

    const { callback } = await oauthFlow(auth, 'beth-github', {
      path: '/link-social',
      session,
    });
    expect(callback.headers.get('location')).toBe('/dashboard');
    expect(cookieValue(callback, 'dashboard.session_token')).toBeNull();
    const beth = await store.users.findByEmail('beth@citadel.io');
    expect(await store.accounts.findByUser(beth!.id, 'fake')).not.toBeNull();

    fake.identity('jerry');
    await oauthFlow(auth, 'jerry');
    fake.identity('jerry-again', { id: 'id-jerry' });
    const stolen = await oauthFlow(auth, 'jerry-again', {
      path: '/link-social',
      session,
    });
    expect(stolen.callback.headers.get('location')).toBe(
      '/dashboard?error=ACCOUNT_ALREADY_LINKED',
    );
  });

  it('refreshes an expired token once for concurrent callers', async () => {
    const { auth, store, fake } = setup();
    fake.setExpiresIn(-10);
    fake.identity('squanchy');
    await oauthFlow(auth, 'squanchy');
    const user = await store.users.findByEmail('squanchy@fake.test');

    const results = await Promise.all(
      [1, 2, 3].map(() =>
        auth.api.getAccessToken({ userId: user!.id, providerId: 'fake' }),
      ),
    );
    expect(fake.calls.refresh).toBe(1);
    expect(results.every((r) => r?.accessToken === 'access-refreshed')).toBe(
      true,
    );
    const account = await store.accounts.findByUser(user!.id, 'fake');
    // Refresh response had no refresh token: the previous one is kept.
    expect(account?.refreshToken).not.toBeNull();
  });

  it('lists accounts without tokens and refuses to unlink the last sign-in method', async () => {
    const { auth, fake } = setup();
    fake.identity('birdperson');
    const { callback } = await oauthFlow(auth, 'birdperson');
    const session = cookieValue(callback, 'dashboard.session_token')!;

    const list = await auth.handler(
      new Request(`${BASE}/list-accounts`, { headers: { cookie: session } }),
    );
    const accounts = await list.json();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).not.toHaveProperty('accessToken');

    const unlink = await post(
      auth,
      '/unlink-account',
      { providerId: 'fake' },
      session,
    );
    expect((await unlink.json()).code).toBe('FAILED_TO_UNLINK_LAST_ACCOUNT');
  });

  it('asks the user to reconnect when the refresh is rejected', async () => {
    const { auth, store, fake } = setup();
    fake.setExpiresIn(-10);
    fake.identity('squanchy');
    await oauthFlow(auth, 'squanchy');
    const user = await store.users.findByEmail('squanchy@fake.test');
    fake.provider.refreshAccessToken = async () => {
      throw new Error('invalid_grant');
    };

    await expect(
      auth.api.getAccessToken({ userId: user!.id, providerId: 'fake' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_REAUTH_REQUIRED' });

    // The dead tokens are gone, the account stays linked.
    const account = await store.accounts.findByUser(user!.id, 'fake');
    expect(account).not.toBeNull();
    expect(account?.accessToken).toBeNull();
    expect(account?.refreshToken).toBeNull();
  });

  it('asks the user to reconnect when the provider cannot refresh', async () => {
    const { auth, store, fake } = setup();
    fake.setExpiresIn(-10);
    fake.identity('squanchy');
    await oauthFlow(auth, 'squanchy');
    const user = await store.users.findByEmail('squanchy@fake.test');
    delete fake.provider.refreshAccessToken;

    await expect(
      auth.api.getAccessToken({ userId: user!.id, providerId: 'fake' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_REAUTH_REQUIRED' });
  });

  it('does not try to refresh a github token', () => {
    const provider = github({ clientId: 'id', clientSecret: 'secret' });

    expect(provider.refreshAccessToken).toBeUndefined();
  });

  it('refuses sign in with a link-only provider', async () => {
    const store: AuthStore = memoryStore();
    const fake = fakeProvider({ disableSignIn: true });
    const auth = createAuth({
      baseURL: BASE,
      secret: 'test-secret-test-secret-test-secret',
      trustedOrigins: [ORIGIN],
      store,
      socialProviders: [fake.provider],
    });
    const response = await post(auth, '/sign-in/social', { provider: 'fake' });
    expect((await response.json()).code).toBe('PROVIDER_SIGN_IN_DISABLED');
  });
});
