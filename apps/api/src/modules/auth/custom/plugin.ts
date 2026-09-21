import type { AuthUser } from '../auth.contract.js';
import type { AuthContext } from './context.js';
import type { AuthEndpoint } from './endpoint.js';

export interface HookContext {
  path: string;
  request: Request;
  auth: AuthContext;
}

export interface BeforeHook {
  matcher(ctx: HookContext): boolean;
  /** Return a Response to short-circuit the endpoint. */
  handler(ctx: HookContext): Promise<Response | void>;
}

export interface AfterHook {
  matcher(ctx: HookContext): boolean;
  /** Return a Response to replace the endpoint response. */
  handler(ctx: HookContext, response: Response): Promise<Response | void>;
}

/**
 * Extension point: a plugin adds endpoints and/or hooks around existing ones.
 * OAuth providers, admin features or 2FA are meant to be written as plugins.
 */
export interface AuthPlugin {
  id: string;
  endpoints?: AuthEndpoint<any>[];
  hooks?: {
    before?: BeforeHook[];
    after?: AfterHook[];
    /**
     * Runs before any session is created, whatever the sign-in method.
     * Throw an AuthError to refuse, or return an updated user.
     */
    sessionCreate?(user: AuthUser, auth: AuthContext): Promise<AuthUser | void>;
  };
}
