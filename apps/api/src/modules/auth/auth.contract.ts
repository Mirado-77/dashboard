/**
 * Contract between the application and whatever implements authentication.
 *
 * Everything outside `modules/auth/custom` depends only on this file. Swapping
 * the hand-made implementation for an external library means providing an
 * object that satisfies `AuthInstance` in `auth.config.ts`; controllers,
 * guards and the web client stay untouched.
 */

export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  role: UserRole;
  banned: boolean;
  banReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  session: AuthSessionRecord;
  user: AuthUser;
}

export interface ProviderAccessToken {
  accessToken: string;
  expiresAt: Date | null;
  scopes: string[];
}

export interface AuthInstance {
  /** Handles every request under `/api/auth/*` using Web standard objects. */
  handler(request: Request): Promise<Response>;
  /** Server-side API, used by guards and other modules. */
  api: {
    getSession(input: { headers: Headers }): Promise<AuthSession | null>;
    /**
     * Returns a valid access token of a linked third-party account, refreshed
     * when expired. Null when the user has not linked this provider.
     */
    getAccessToken(input: {
      userId: string;
      providerId: string;
    }): Promise<ProviderAccessToken | null>;
  };
}
