import { z } from 'zod';
import type { AuthUser } from '../../auth.contract.js';
import { CREDENTIAL_PROVIDER, type AuthContext } from '../context.js';
import { parseCookies } from '../cookies.js';
import { generateId, generateToken, sha256 } from '../crypto.js';
import { defineEndpoint, type EndpointContext } from '../endpoint.js';
import { AuthError, Errors } from '../errors.js';
import type { OAuthProvider, OAuthUserInfo } from '../oauth/provider.js';
import { encryptTokens, parseScopes } from '../oauth/tokens.js';

const STATE_COOKIE = 'oauth_state';
const STATE_TTL = 10 * 60;
const STATE_PREFIX = 'oauth-state:';

interface OAuthState {
  providerId: string;
  codeVerifier: string;
  callbackURL: string;
  errorCallbackURL: string | null;
  /** Set when an authenticated user links a new account. */
  linkUserId: string | null;
}

const oauthError = (code: string, message: string) =>
  new AuthError(400, code, message);

function getProvider(auth: AuthContext, id: string): OAuthProvider {
  const provider = auth.options.socialProviders?.find((p) => p.id === id);
  if (!provider) throw oauthError('PROVIDER_NOT_FOUND', 'Provider not found');
  return provider;
}

function redirectURI(auth: AuthContext, provider: OAuthProvider) {
  return `${auth.options.baseURL.replace(/\/$/, '')}/callback/${provider.id}`;
}

const flowBody = z.object({
  provider: z.string().min(1),
  callbackURL: z.string().optional(),
  errorCallbackURL: z.string().optional(),
  scopes: z
    .array(z.string().regex(/^[\w:./-]+$/))
    .max(20)
    .optional(),
});

async function startFlow(
  ctx: EndpointContext<z.infer<typeof flowBody>>,
  linkUserId: string | null,
): Promise<Response> {
  const { auth, body, json, responseHeaders } = ctx;
  const provider = getProvider(auth, body.provider);
  if (!linkUserId && provider.disableSignIn) {
    throw oauthError(
      'PROVIDER_SIGN_IN_DISABLED',
      'This provider cannot be used to sign in',
    );
  }
  auth.assertCallbackURL(body.callbackURL);
  auth.assertCallbackURL(body.errorCallbackURL);

  const state = generateToken();
  const codeVerifier = generateToken(48);
  const data: OAuthState = {
    providerId: provider.id,
    codeVerifier,
    callbackURL: body.callbackURL ?? '/',
    errorCallbackURL: body.errorCallbackURL ?? null,
    linkUserId,
  };
  await auth.store.verifications.create({
    id: generateId(),
    identifier: `${STATE_PREFIX}${sha256(state)}`,
    value: JSON.stringify(data),
    expiresAt: new Date(Date.now() + STATE_TTL * 1000),
  });
  // Binds the flow to this browser, the callback compares both values.
  responseHeaders.append(
    'set-cookie',
    auth.cookie(STATE_COOKIE, state, STATE_TTL),
  );

  const url = provider.createAuthorizationURL({
    state,
    codeVerifier,
    redirectURI: redirectURI(auth, provider),
    scopes: body.scopes,
  });
  return json({ url: url.toString(), redirect: true });
}

export const listProviders = defineEndpoint({
  method: 'GET',
  path: '/providers',
  async handler({ auth, json }) {
    return json(
      (auth.options.socialProviders ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        signIn: !p.disableSignIn,
      })),
    );
  },
});

export const signInSocial = defineEndpoint({
  method: 'POST',
  path: '/sign-in/social',
  body: flowBody,
  handler: (ctx) => startFlow(ctx, null),
});

export const linkSocial = defineEndpoint({
  method: 'POST',
  path: '/link-social',
  body: flowBody,
  async handler(ctx) {
    const { user } = await ctx.requireSession();
    return startFlow(ctx, user.id);
  },
});

async function consumeState(
  auth: AuthContext,
  request: Request,
  state: string | null,
) {
  const cookieState = parseCookies(request.headers.get('cookie')).get(
    auth.cookieName(STATE_COOKIE),
  );
  if (!state || !cookieState || cookieState !== state) {
    throw oauthError('STATE_MISMATCH', 'Invalid OAuth state');
  }
  const verification = await auth.store.verifications.findByIdentifier(
    `${STATE_PREFIX}${sha256(state)}`,
  );
  if (!verification) throw oauthError('STATE_MISMATCH', 'Invalid OAuth state');
  await auth.store.verifications.deleteById(verification.id);
  if (verification.expiresAt.getTime() <= Date.now()) {
    throw oauthError('STATE_EXPIRED', 'OAuth flow expired, try again');
  }
  return JSON.parse(verification.value) as OAuthState;
}

/** Resolves or creates the platform user behind a provider identity. */
async function resolveUser(
  auth: AuthContext,
  provider: OAuthProvider,
  info: OAuthUserInfo,
  tokenColumns: ReturnType<typeof encryptTokens>,
): Promise<AuthUser> {
  const store = auth.store;
  const existingAccount = await store.accounts.findByProvider(
    provider.id,
    info.id,
  );
  if (existingAccount) {
    await store.accounts.update(existingAccount.id, tokenColumns);
    const user = await store.users.findById(existingAccount.userId);
    if (!user) throw oauthError('USER_NOT_FOUND', 'User not found');
    return user;
  }

  if (!info.email) {
    throw oauthError(
      'EMAIL_NOT_FOUND',
      'The provider did not share an email address',
    );
  }
  const email = info.email.toLowerCase();
  const existingUser = await store.users.findByEmail(email);

  if (existingUser) {
    const linking = auth.options.accountLinking;
    const trusted =
      info.emailVerified ||
      (linking?.trustedProviders ?? []).includes(provider.id);
    if (linking?.enabled === false || !trusted) {
      throw oauthError(
        'ACCOUNT_NOT_LINKED',
        'An account already uses this email, sign in and link the provider from your settings',
      );
    }
    return store.transaction(async (tx) => {
      await tx.accounts.create({
        id: generateId(),
        userId: existingUser.id,
        providerId: provider.id,
        accountId: info.id,
        password: null,
        ...tokenColumns,
      });
      if (existingUser.emailVerified || !info.emailVerified)
        return existingUser;

      // The local account never proved ownership of the email but the provider
      // did: drop its password and sessions so a squatter cannot keep access.
      const credential = await tx.accounts.findByUser(
        existingUser.id,
        CREDENTIAL_PROVIDER,
      );
      if (credential) await tx.accounts.delete(credential.id);
      await tx.sessions.deleteByUser(existingUser.id);
      return (
        (await tx.users.update(existingUser.id, { emailVerified: true })) ??
        existingUser
      );
    });
  }

  return store.transaction(async (tx) => {
    const user = await tx.users.create({
      id: generateId(),
      name: info.name.slice(0, 100) || email,
      email,
      emailVerified: info.emailVerified,
      image: info.image,
      role: 'user',
      banned: false,
      banReason: null,
    });
    await tx.accounts.create({
      id: generateId(),
      userId: user.id,
      providerId: provider.id,
      accountId: info.id,
      password: null,
      ...tokenColumns,
    });
    return user;
  });
}

async function linkAccount(
  auth: AuthContext,
  userId: string,
  provider: OAuthProvider,
  info: OAuthUserInfo,
  tokenColumns: ReturnType<typeof encryptTokens>,
) {
  const existing = await auth.store.accounts.findByProvider(
    provider.id,
    info.id,
  );
  if (existing && existing.userId !== userId) {
    throw oauthError(
      'ACCOUNT_ALREADY_LINKED',
      'This account is already linked to another user',
    );
  }
  if (existing) {
    await auth.store.accounts.update(existing.id, tokenColumns);
    return;
  }
  // One account per provider per user: re-linking replaces the previous one.
  const previous = await auth.store.accounts.findByUser(userId, provider.id);
  if (previous) await auth.store.accounts.delete(previous.id);
  await auth.store.accounts.create({
    id: generateId(),
    userId,
    providerId: provider.id,
    accountId: info.id,
    password: null,
    ...tokenColumns,
  });
}

export const oauthCallback = defineEndpoint({
  method: 'GET',
  path: '/callback/:providerId',
  async handler({ auth, request, url, params, redirect, responseHeaders }) {
    responseHeaders.append('set-cookie', auth.cookie(STATE_COOKIE, '', 0));
    let state: OAuthState | null = null;

    try {
      state = await consumeState(auth, request, url.searchParams.get('state'));
      if (state.providerId !== params.providerId) {
        throw oauthError('STATE_MISMATCH', 'Invalid OAuth state');
      }
      if (url.searchParams.get('error')) {
        throw oauthError('ACCESS_DENIED', 'Authorization was denied');
      }
      const code = url.searchParams.get('code');
      if (!code) throw oauthError('MISSING_CODE', 'Missing authorization code');

      const provider = getProvider(auth, state.providerId);
      let info: OAuthUserInfo;
      let tokenColumns: ReturnType<typeof encryptTokens>;
      try {
        const tokens = await provider.validateAuthorizationCode({
          code,
          codeVerifier: state.codeVerifier,
          redirectURI: redirectURI(auth, provider),
        });
        info = await provider.getUserInfo(tokens);
        tokenColumns = encryptTokens(auth, tokens);
      } catch (error) {
        auth.logger.error(`[auth] ${provider.id} OAuth exchange failed`, error);
        throw oauthError(
          'OAUTH_FAILED',
          'Could not complete the sign in with the provider',
        );
      }

      if (state.linkUserId) {
        await linkAccount(auth, state.linkUserId, provider, info, tokenColumns);
        return redirect(state.callbackURL);
      }

      const user = await resolveUser(auth, provider, info, tokenColumns);
      if (
        auth.options.emailAndPassword?.requireEmailVerification &&
        !user.emailVerified
      ) {
        await auth.sendVerificationEmail(user, '/verify-email');
        throw Errors.emailNotVerified();
      }
      responseHeaders.append(
        'set-cookie',
        await auth.createSession(user, request),
      );
      return redirect(state.callbackURL);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      const target =
        state?.errorCallbackURL ??
        state?.callbackURL ??
        auth.options.errorURL ??
        '/';
      const separator = target.includes('?') ? '&' : '?';
      return redirect(`${target}${separator}error=${error.code}`);
    }
  },
});

export const listAccounts = defineEndpoint({
  method: 'GET',
  path: '/list-accounts',
  async handler({ auth, json, requireSession }) {
    const { user } = await requireSession();
    const accounts = await auth.store.accounts.listByUser(user.id);
    return json(
      accounts.map((account) => ({
        id: account.id,
        providerId: account.providerId,
        accountId: account.accountId,
        scopes: parseScopes(account.scope),
        createdAt: account.createdAt,
      })),
    );
  },
});

export const unlinkAccount = defineEndpoint({
  method: 'POST',
  path: '/unlink-account',
  body: z.object({ providerId: z.string().min(1) }),
  async handler({ auth, body, json, requireSession }) {
    const { user } = await requireSession();
    const accounts = await auth.store.accounts.listByUser(user.id);
    const account = accounts.find((a) => a.providerId === body.providerId);
    if (!account) throw oauthError('ACCOUNT_NOT_FOUND', 'Account not found');
    const canSignIn = (providerId: string) =>
      providerId === CREDENTIAL_PROVIDER ||
      auth.options.socialProviders?.some(
        (p) => p.id === providerId && !p.disableSignIn,
      );
    const remaining = accounts.filter(
      (a) => a.id !== account.id && canSignIn(a.providerId),
    );
    if (canSignIn(account.providerId) && remaining.length === 0) {
      throw oauthError(
        'FAILED_TO_UNLINK_LAST_ACCOUNT',
        'You cannot unlink your last sign-in method',
      );
    }
    await auth.store.accounts.delete(account.id);
    return json({ status: true });
  },
});
