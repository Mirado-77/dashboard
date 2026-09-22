import type { AuthInstance } from '../auth.contract.js';
import { createAuth } from './create-auth.js';
import type { AuthOptions } from './options.js';
import { memoryStore } from './store/memory.js';

const ORIGIN = 'http://localhost:8081';
const BASE = `${ORIGIN}/api/auth`;

function setup(overrides: Partial<AuthOptions> = {}) {
  const mails: { email: string; url: string; token: string }[] = [];
  const auth = createAuth({
    baseURL: BASE,
    secret: 'test-secret-test-secret-test-secret',
    trustedOrigins: [ORIGIN],
    store: memoryStore(),
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url, token }) {
        mails.push({ email: user.email, url, token });
      },
    },
    logger: { error: () => {}, warn: () => {} },
    ...overrides,
  });
  return { auth, mails };
}

function post(auth: AuthInstance, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return auth.handler(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

function cookieOf(response: Response): string {
  return response.headers.getSetCookie()[0].split(';')[0];
}

const credentials = { name: 'Rick', email: 'Rick@Citadel.io', password: 'wubbalubba' };

async function signUpAndVerify(auth: AuthInstance, mails: { url: string }[]) {
  await post(auth, '/sign-up/email', credentials);
  return auth.handler(new Request(mails[0].url));
}

describe('createAuth', () => {
  it('signs up without session and sends a verification email', async () => {
    const { auth, mails } = setup();
    const response = await post(auth, '/sign-up/email', credentials);

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toHaveLength(0);
    const body = await response.json();
    expect(body.user.email).toBe('rick@citadel.io');
    expect(body.user).not.toHaveProperty('password');
    expect(mails).toHaveLength(1);
    expect(mails[0].url).toContain(`${BASE}/verify-email?token=`);
  });

  it('rejects duplicate email and short password', async () => {
    const { auth } = setup();
    await post(auth, '/sign-up/email', credentials);

    expect((await post(auth, '/sign-up/email', credentials)).status).toBe(422);
    const short = await post(auth, '/sign-up/email', { ...credentials, email: 'a@b.io', password: '123' });
    expect(short.status).toBe(400);
    expect((await short.json()).code).toBe('PASSWORD_TOO_SHORT');
  });

  it('refuses sign in until the email is verified', async () => {
    const { auth } = setup();
    await post(auth, '/sign-up/email', credentials);
    const response = await post(auth, '/sign-in/email', credentials);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('verifies the email, signs in and resolves the session', async () => {
    const { auth, mails } = setup();
    const verified = await signUpAndVerify(auth, mails);
    expect(verified.status).toBe(200);
    expect(verified.headers.getSetCookie()[0]).toMatch(/HttpOnly/);

    const signIn = await post(auth, '/sign-in/email', credentials);
    expect(signIn.status).toBe(200);
    const cookie = cookieOf(signIn);

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.emailVerified).toBe(true);

    const reused = await auth.handler(new Request(mails[0].url));
    expect(reused.status).toBe(400);
  });

  it('returns the same error for unknown user and wrong password', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);

    const wrong = await post(auth, '/sign-in/email', { ...credentials, password: 'nope-nope' });
    const unknown = await post(auth, '/sign-in/email', { ...credentials, email: 'morty@citadel.io' });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it('signs out and invalidates the session', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);
    const cookie = cookieOf(await post(auth, '/sign-in/email', credentials));

    const out = await post(auth, '/sign-out', undefined, { cookie });
    expect(out.status).toBe(200);
    expect(out.headers.getSetCookie()[0]).toMatch(/Max-Age=0/);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });

  it('rejects state-changing requests from untrusted origins', async () => {
    const { auth } = setup();
    const response = await post(auth, '/sign-up/email', credentials, { origin: 'https://evil.io' });
    expect(response.status).toBe(403);
  });

  it('rejects external callback URLs', async () => {
    const { auth } = setup();
    const response = await post(auth, '/sign-up/email', { ...credentials, callbackURL: 'https://evil.io' });
    expect(response.status).toBe(403);
    const relative = await post(auth, '/sign-up/email', { ...credentials, callbackURL: '//evil.io' });
    expect(relative.status).toBe(403);
  });

  it('rate limits per path', async () => {
    const { auth } = setup({
      rateLimit: { window: 60, max: 100, customRules: { '/sign-in/email': { window: 60, max: 2 } } },
    });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await post(auth, '/sign-in/email', credentials)).status);
    }
    expect(statuses).toEqual([401, 401, 429]);
  });

  it('runs plugin endpoints and hooks', async () => {
    const { auth } = setup({
      plugins: [
        {
          id: 'test',
          endpoints: [{ method: 'GET', path: '/ping', handler: async ({ json }) => json({ pong: true }) }],
          hooks: {
            before: [{ matcher: (ctx) => ctx.path === '/sign-up/email', handler: async () => Response.json({ blocked: true }, { status: 418 }) }],
          },
        },
      ],
    });
    expect(await (await auth.handler(new Request(`${BASE}/ping`))).json()).toEqual({ pong: true });
    expect((await post(auth, '/sign-up/email', credentials)).status).toBe(418);
  });

  it('updates the name of the caller only', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);
    const cookie = cookieOf(await post(auth, '/sign-in/email', credentials));

    const response = await post(auth, '/update-user', { name: '  Morty  ' }, { cookie });
    expect(response.status).toBe(200);
    expect((await response.json()).user.name).toBe('Morty');

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.name).toBe('Morty');
  });

  it('rejects a name update without session or with an empty name', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);
    const cookie = cookieOf(await post(auth, '/sign-in/email', credentials));

    expect((await post(auth, '/update-user', { name: 'Morty' })).status).toBe(401);
    expect((await post(auth, '/update-user', { name: '   ' }, { cookie })).status).toBe(400);
  });

  it('changes the password and signs in with the new one', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);
    const cookie = cookieOf(await post(auth, '/sign-in/email', credentials));
    const newPassword = 'pickle-rick-99';

    const response = await post(
      auth,
      '/update-password',
      { currentPassword: credentials.password, newPassword },
      { cookie },
    );
    expect(response.status).toBe(200);

    expect((await post(auth, '/sign-in/email', credentials)).status).toBe(401);
    expect(
      (await post(auth, '/sign-in/email', { ...credentials, password: newPassword })).status,
    ).toBe(200);
  });

  it('refuses a wrong current password and a too short new one', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);
    const cookie = cookieOf(await post(auth, '/sign-in/email', credentials));

    const wrong = await post(
      auth,
      '/update-password',
      { currentPassword: 'not-my-password', newPassword: 'pickle-rick-99' },
      { cookie },
    );
    expect(wrong.status).toBe(401);

    const short = await post(
      auth,
      '/update-password',
      { currentPassword: credentials.password, newPassword: '123' },
      { cookie },
    );
    expect(short.status).toBe(400);
    expect((await short.json()).code).toBe('PASSWORD_TOO_SHORT');

    // The password still works, nothing was changed.
    expect((await post(auth, '/sign-in/email', credentials)).status).toBe(200);
  });

  it('requires a session to change the password', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);

    const response = await post(auth, '/update-password', {
      currentPassword: credentials.password,
      newPassword: 'pickle-rick-99',
    });
    expect(response.status).toBe(401);
  });

  it('revokes the other sessions but keeps the caller signed in', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);
    const otherDevice = cookieOf(await post(auth, '/sign-in/email', credentials));
    const cookie = cookieOf(await post(auth, '/sign-in/email', credentials));

    const response = await post(
      auth,
      '/update-password',
      {
        currentPassword: credentials.password,
        newPassword: 'pickle-rick-99',
        revokeOtherSessions: true,
      },
      { cookie },
    );
    expect(response.status).toBe(200);

    expect(await auth.api.getSession({ headers: new Headers({ cookie: otherDevice }) })).toBeNull();
    // The endpoint may refresh the cookie, so read the session from the latest one.
    const current = response.headers.getSetCookie()[0]
      ? cookieOf(response)
      : cookie;
    expect(await auth.api.getSession({ headers: new Headers({ cookie: current }) })).not.toBeNull();
  });

  it('keeps the other sessions when the option is not set', async () => {
    const { auth, mails } = setup();
    await signUpAndVerify(auth, mails);
    const otherDevice = cookieOf(await post(auth, '/sign-in/email', credentials));
    const cookie = cookieOf(await post(auth, '/sign-in/email', credentials));

    await post(
      auth,
      '/update-password',
      { currentPassword: credentials.password, newPassword: 'pickle-rick-99' },
      { cookie },
    );

    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: otherDevice }) }),
    ).not.toBeNull();
  });

  it('returns 404 for unknown routes', async () => {
    const { auth } = setup();
    expect((await auth.handler(new Request(`${BASE}/nope`))).status).toBe(404);
  });
});
