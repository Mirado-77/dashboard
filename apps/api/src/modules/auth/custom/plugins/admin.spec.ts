import type { AuthInstance } from '../../auth.contract.js';
import { createAuth } from '../create-auth.js';
import { memoryStore } from '../store/memory.js';
import { admin } from './admin.js';

const ORIGIN = 'http://localhost:8081';
const BASE = `${ORIGIN}/api/auth`;

function setup() {
  const store = memoryStore();
  const auth = createAuth({
    baseURL: BASE,
    secret: 'test-secret-test-secret-test-secret',
    trustedOrigins: [ORIGIN],
    store,
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false, window: 60, max: 100 },
    plugins: [admin({ adminEmails: ['rick@citadel.io'] })],
  });
  return { auth, store };
}

function call(
  auth: AuthInstance,
  path: string,
  cookie: string | null,
  body?: unknown,
) {
  return auth.handler(
    new Request(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function signUp(auth: AuthInstance, email: string) {
  const response = await call(auth, '/sign-up/email', null, {
    name: email.split('@')[0],
    email,
    password: 'password123',
  });
  const { user } = await response.json();
  return {
    id: user.id as string,
    cookie: response.headers.getSetCookie()[0].split(';')[0],
  };
}

async function signIn(auth: AuthInstance, email: string) {
  const response = await call(auth, '/sign-in/email', null, {
    email,
    password: 'password123',
  });
  return response.headers.getSetCookie()[0]?.split(';')[0] ?? null;
}

describe('admin plugin', () => {
  it('promotes configured emails and restricts endpoints to admins', async () => {
    const { auth } = setup();
    const rick = await signUp(auth, 'rick@citadel.io');
    const morty = await signUp(auth, 'morty@citadel.io');

    expect((await call(auth, '/admin/list-users', null)).status).toBe(401);
    expect((await call(auth, '/admin/list-users', morty.cookie)).status).toBe(
      403,
    );

    const list = await call(
      auth,
      '/admin/list-users?search=MORTY',
      rick.cookie,
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.total).toBe(1);
    expect(body.users[0].id).toBe(morty.id);
  });

  it('bans a user, revokes sessions and blocks new sign ins', async () => {
    const { auth } = setup();
    const rick = await signUp(auth, 'rick@citadel.io');
    const morty = await signUp(auth, 'morty@citadel.io');

    const ban = await call(auth, '/admin/ban-user', rick.cookie, {
      userId: morty.id,
      banReason: 'spam',
    });
    expect((await ban.json()).user.banned).toBe(true);
    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: morty.cookie }),
      }),
    ).toBeNull();

    const refused = await call(auth, '/sign-in/email', null, {
      email: 'morty@citadel.io',
      password: 'password123',
    });
    expect((await refused.json()).code).toBe('USER_BANNED');

    await call(auth, '/admin/unban-user', rick.cookie, { userId: morty.id });
    expect(await signIn(auth, 'morty@citadel.io')).not.toBeNull();
  });

  it('changes roles, removes users and protects the acting admin', async () => {
    const { auth, store } = setup();
    const rick = await signUp(auth, 'rick@citadel.io');
    const morty = await signUp(auth, 'morty@citadel.io');

    const self = await call(auth, '/admin/ban-user', rick.cookie, {
      userId: rick.id,
    });
    expect((await self.json()).code).toBe('CANNOT_TARGET_SELF');

    const role = await call(auth, '/admin/set-role', rick.cookie, {
      userId: morty.id,
      role: 'admin',
    });
    expect((await role.json()).user.role).toBe('admin');

    expect(
      (
        await call(auth, '/admin/remove-user', rick.cookie, {
          userId: morty.id,
        })
      ).status,
    ).toBe(200);
    expect(await store.users.findById(morty.id)).toBeNull();
    expect(
      (await call(auth, '/admin/remove-user', rick.cookie, { userId: 'nope' }))
        .status,
    ).toBe(404);
  });
});
