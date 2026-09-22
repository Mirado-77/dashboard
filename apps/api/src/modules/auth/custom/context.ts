import type { AuthSession, AuthUser } from '../auth.contract.js';
import { parseCookies, serializeCookie } from './cookies.js';
import {
  createSecretBox,
  generateId,
  generateToken,
  scryptHasher,
  sha256,
  type PasswordHasher,
  type SecretBox,
} from './crypto.js';
import { Errors } from './errors.js';
import type { AuthOptions } from './options.js';
import type { AuthStore } from './store/store.js';

const DAY = 60 * 60 * 24;

export const CREDENTIAL_PROVIDER = 'credential';
const EMAIL_VERIFICATION_PREFIX = 'email-verification:';
const EMAIL_RESET_PASSWORD_PREFIX = 'email-reset-password';

export interface AuthContext {
  options: AuthOptions;
  basePath: string;
  store: AuthStore;
  hasher: PasswordHasher;
  secretBox: SecretBox;
  logger: Pick<Console, 'error' | 'warn'>;
  sessionCookieName: string;
  /** Full name of a prefixed auth cookie, e.g. `oauth_state`. */
  cookieName(name: string): string;
  /** Serializes a prefixed auth cookie. */
  cookie(name: string, value: string, maxAge: number): string;
  /** Runs plugin hooks, creates a session and returns the Set-Cookie value. */
  createSession(
    user: AuthUser,
    request: Request,
    rememberMe?: boolean,
  ): Promise<string>;
  /** Resolves the session of a request, extending it when needed. */
  getSession(
    headers: Headers,
  ): Promise<{ data: AuthSession; refreshedCookie: string | null } | null>;
  deleteSession(headers: Headers): Promise<void>;
  clearSessionCookie(): string;
  sendVerificationEmail(user: AuthUser, callbackURL?: string): Promise<void>;
  sendResetPassword(user: AuthUser, callbackURL?: string): Promise<void>;
  /** Consumes a verification token and returns the linked user id. */
  consumeVerificationToken(token: string): Promise<string>;
  consumeResetPasswordToken(token: string): Promise<string>;
  assertCallbackURL(url: string | undefined): void;
}

export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}

export function createContext(options: AuthOptions): AuthContext {
  const store = options.store;
  const expiresIn = options.session?.expiresIn ?? 7 * DAY;
  const updateAge = options.session?.updateAge ?? DAY;
  const cookiePrefix = options.session?.cookiePrefix ?? 'dashboard';
  const cookieName = `${cookiePrefix}.session_token`;
  const secure =
    options.session?.secureCookies ?? options.baseURL.startsWith('https://');
  const trustedOrigins = new Set(
    options.trustedOrigins.map((origin) => new URL(origin).origin),
  );

  const cookie = (token: string, maxAge: number, name = cookieName) =>
    serializeCookie(name, token, {
      maxAge,
      secure,
      httpOnly: true,
      sameSite: 'Lax',
    });

  const readToken = (headers: Headers) =>
    parseCookies(headers.get('cookie')).get(cookieName) ?? null;

  const sessionCreateHooks = (options.plugins ?? []).flatMap((plugin) =>
    plugin.hooks?.sessionCreate ? [plugin.hooks.sessionCreate] : [],
  );

  const context: AuthContext = {
    options,
    basePath: new URL(options.baseURL).pathname.replace(/\/$/, ''),
    store,
    hasher: options.passwordHasher ?? scryptHasher,
    secretBox: createSecretBox(options.secret),
    logger: options.logger ?? console,
    sessionCookieName: cookieName,
    cookieName: (name) => `${cookiePrefix}.${name}`,
    cookie: (name, value, maxAge) =>
      cookie(value, maxAge, `${cookiePrefix}.${name}`),

    async createSession(initialUser, request, rememberMe = true) {
      let user = initialUser;
      for (const hook of sessionCreateHooks) {
        user = (await hook(user, context)) ?? user;
      }
      if (user.banned) throw Errors.userBanned();

      const token = generateToken();
      await store.sessions.create({
        id: generateId(),
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        ipAddress: getClientIp(request.headers),
        userAgent: request.headers.get('user-agent'),
      });
      // Without "remember me" the cookie lives for the browser session only.
      return rememberMe
        ? cookie(token, expiresIn)
        : serializeCookie(cookieName, token, { secure, sameSite: 'Lax' });
    },

    async getSession(headers) {
      const token = readToken(headers);
      if (!token) return null;
      const tokenHash = sha256(token);
      const data = await store.sessions.findByTokenHash(tokenHash);
      if (!data) return null;

      const now = Date.now();
      if (data.session.expiresAt.getTime() <= now || data.user.banned) {
        await store.sessions.deleteByTokenHash(tokenHash);
        return null;
      }

      let refreshedCookie: string | null = null;
      const age = expiresIn * 1000 - (data.session.expiresAt.getTime() - now);
      if (age >= updateAge * 1000) {
        const expiresAt = new Date(now + expiresIn * 1000);
        await store.sessions.update(data.session.id, { expiresAt });
        data.session.expiresAt = expiresAt;
        refreshedCookie = cookie(token, expiresIn);
      }
      return { data, refreshedCookie };
    },

    async deleteSession(headers) {
      const token = readToken(headers);
      if (token) await store.sessions.deleteByTokenHash(sha256(token));
    },

    clearSessionCookie: () => cookie('', 0),

    async sendVerificationEmail(user, callbackURL) {
      const config = options.emailVerification;
      if (!config) return;
      const token = generateToken();
      await store.verifications.create({
        id: generateId(),
        identifier: `${EMAIL_VERIFICATION_PREFIX}${sha256(token)}`,
        value: user.id,
        expiresAt: new Date(Date.now() + (config.expiresIn ?? 3600) * 1000),
      });
      const url = new URL(`${options.baseURL.replace(/\/$/, '')}/verify-email`);
      url.searchParams.set('token', token);
      if (callbackURL) url.searchParams.set('callbackURL', callbackURL);
      await config.sendVerificationEmail({ user, url: url.toString(), token });
    },

    async sendResetPassword(user, callbackURL) {
      const config = options.emailResetPassword;
      if (!config) return;
      const token = generateToken();
      await store.verifications.create({
        id: generateId(),
        identifier: `${EMAIL_RESET_PASSWORD_PREFIX}${sha256(token)}`,
        value: user.id,
        expiresAt: new Date(Date.now() + (config.expiresIn ?? 3600) * 1000),
      });

      const url = new URL(
        callbackURL ?? '/reset-password',
        new URL(options.baseURL).origin,
      );
      url.searchParams.set('token', token);

      await config.sendResetPassword({ user, url: url.toString(), token });
    },

    async consumeVerificationToken(token) {
      const identifier = `${EMAIL_VERIFICATION_PREFIX}${sha256(token)}`;
      const verification =
        await store.verifications.findByIdentifier(identifier);
      if (!verification) throw Errors.invalidToken();
      await store.verifications.deleteById(verification.id);
      if (verification.expiresAt.getTime() <= Date.now()) {
        throw Errors.invalidToken();
      }
      return verification.value;
    },

    async consumeResetPasswordToken(token) {
      const identifier = `${EMAIL_RESET_PASSWORD_PREFIX}${sha256(token)}`;
      const verification =
        await store.verifications.findByIdentifier(identifier);
      if (!verification) throw Errors.invalidToken();

      await store.verifications.deleteById(verification.id);
      if (verification.expiresAt.getTime() <= Date.now()) {
        throw Errors.invalidToken();
      }
      return verification.value;
    },

    assertCallbackURL(url) {
      if (url === undefined) return;
      // Relative paths only, "//host" would be protocol-relative.
      if (
        url.startsWith('/') &&
        !url.startsWith('//') &&
        !url.startsWith('/\\')
      ) {
        return;
      }
      try {
        if (trustedOrigins.has(new URL(url).origin)) return;
      } catch {
        // Falls through to the error below.
      }
      throw Errors.invalidCallbackURL();
    },
  };
  return context;
}

export function isTrustedOrigin(ctx: AuthContext, origin: string): boolean {
  return ctx.options.trustedOrigins.some(
    (trusted) => new URL(trusted).origin === origin,
  );
}
