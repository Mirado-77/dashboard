import type { AuthUser } from '../auth.contract.js';
import type { PasswordHasher } from './crypto.js';
import type { OAuthProvider } from './oauth/provider.js';
import type { AuthPlugin } from './plugin.js';
import type { AuthStore } from './store/store.js';

export interface RateLimitRule {
  /** Window length in seconds. */
  window: number;
  max: number;
}

export interface AuthOptions {
  /** Public URL of the auth routes, e.g. `http://localhost:8081/api/auth`. */
  baseURL: string;
  /** At least 32 characters. Encrypts third-party tokens stored in database. */
  secret: string;
  /** Origins allowed to send state-changing requests and to be redirected to. */
  trustedOrigins: string[];
  store: AuthStore;
  passwordHasher?: PasswordHasher;
  emailAndPassword?: {
    enabled: boolean;
    minPasswordLength?: number;
    maxPasswordLength?: number;
    requireEmailVerification?: boolean;
  };
  emailVerification?: {
    sendVerificationEmail(data: {
      user: AuthUser;
      url: string;
      token: string;
    }): Promise<void>;
    sendOnSignUp?: boolean;
    sendOnSignIn?: boolean;
    autoSignInAfterVerification?: boolean;
    /** Token lifetime in seconds. */
    expiresIn?: number;
  };
  emailResetPassword?: {
    sendResetPassword(data: {
      user: AuthUser;
      url: string;
      token: string;
    }): Promise<void>;
    expiresIn?: number;
  };
  socialProviders?: OAuthProvider[];
  accountLinking?: {
    /** Link a provider account to an existing user with the same email. */
    enabled?: boolean;
    /** Providers trusted to link even when they do not verify the email. */
    trustedProviders?: string[];
  };
  /** Where OAuth errors land when the flow has no error callback. */
  errorURL?: string;
  session?: {
    /** Session lifetime in seconds. */
    expiresIn?: number;
    /** Extend the session when it is older than this many seconds. */
    updateAge?: number;
    cookiePrefix?: string;
    secureCookies?: boolean;
  };
  rateLimit?: RateLimitRule & {
    enabled?: boolean;
    /** Per-path overrides, keyed by path relative to the base URL. */
    customRules?: Record<string, RateLimitRule>;
  };
  plugins?: AuthPlugin[];
  logger?: Pick<Console, 'error' | 'warn'>;
}
