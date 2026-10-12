import { z } from 'zod';
import { CREDENTIAL_PROVIDER, type AuthContext } from '../context.js';
import { generateId } from '../crypto.js';
import { AuthError, Errors } from '../errors.js';
import { defineEndpoint } from '../endpoint.js';
import { callbackURL, email, password } from './schemas.js';

// Hash compared when the user does not exist, so both paths take the same time.
let dummyHash: Promise<string> | undefined;

export function assertPasswordLength(auth: AuthContext, password: string) {
  const config = auth.options.emailAndPassword;
  const min = config?.minPasswordLength ?? 8;
  const max = config?.maxPasswordLength ?? 128;
  if (password.length < min) {
    throw new AuthError(
      400,
      'PASSWORD_TOO_SHORT',
      `Password must be at least ${min} characters`,
    );
  }
  if (password.length > max) {
    throw new AuthError(
      400,
      'PASSWORD_TOO_LONG',
      `Password must be at most ${max} characters`,
    );
  }
}

export const signUpEmail = defineEndpoint({
  method: 'POST',
  path: '/sign-up/email',
  body: z.strictObject({
    name: z.string().trim().min(1).max(100),
    email,
    password,
    callbackURL,
  }),
  async handler({ body, auth, request, json, responseHeaders }) {
    assertPasswordLength(auth, body.password);
    auth.assertCallbackURL(body.callbackURL);

    if (await auth.store.users.findByEmail(body.email)) {
      throw Errors.userAlreadyExists();
    }

    const passwordHash = await auth.hasher.hash(body.password);
    const user = await auth.store.transaction(async (store) => {
      const created = await store.users.create({
        id: generateId(),
        name: body.name,
        email: body.email,
        emailVerified: false,
        image: null,
        role: 'user',
        banned: false,
        banReason: null,
      });
      await store.accounts.create({
        id: generateId(),
        userId: created.id,
        providerId: CREDENTIAL_PROVIDER,
        accountId: created.id,
        password: passwordHash,
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
      });
      return created;
    });

    if (auth.options.emailVerification?.sendOnSignUp) {
      await auth.sendVerificationEmail(user, body.callbackURL);
    }

    if (auth.options.emailAndPassword?.requireEmailVerification) {
      return json({ user, token: null });
    }
    responseHeaders.append(
      'set-cookie',
      await auth.createSession(user, request),
    );
    return json({ user });
  },
});

export const signInEmail = defineEndpoint({
  method: 'POST',
  path: '/sign-in/email',
  body: z.strictObject({
    email,
    password,
    rememberMe: z.boolean().optional(),
    callbackURL,
  }),
  async handler({ body, auth, request, json, responseHeaders }) {
    auth.assertCallbackURL(body.callbackURL);

    const user = await auth.store.users.findByEmail(body.email);
    const account = user
      ? await auth.store.accounts.findByUser(user.id, CREDENTIAL_PROVIDER)
      : null;

    if (!user || !account?.password) {
      dummyHash ??= auth.hasher.hash('dummy-password');
      await auth.hasher.verify(body.password, await dummyHash);
      throw Errors.invalidCredentials();
    }
    if (!(await auth.hasher.verify(body.password, account.password))) {
      throw Errors.invalidCredentials();
    }

    if (
      auth.options.emailAndPassword?.requireEmailVerification &&
      !user.emailVerified
    ) {
      if (auth.options.emailVerification?.sendOnSignIn) {
        await auth.sendVerificationEmail(user, body.callbackURL);
      }
      throw Errors.emailNotVerified();
    }

    responseHeaders.append(
      'set-cookie',
      await auth.createSession(user, request, body.rememberMe ?? true),
    );
    return json({
      user,
      redirect: Boolean(body.callbackURL),
      url: body.callbackURL ?? null,
    });
  },
});
