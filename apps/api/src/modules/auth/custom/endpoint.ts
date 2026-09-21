import type { z } from 'zod';
import type { AuthSession } from '../auth.contract.js';
import type { AuthContext } from './context.js';

export interface EndpointContext<TBody> {
  request: Request;
  url: URL;
  /** Values of `:name` segments in the endpoint path. */
  params: Record<string, string>;
  body: TBody;
  auth: AuthContext;
  /** Headers merged into the response, used for Set-Cookie. */
  responseHeaders: Headers;
  json(data: unknown, status?: number): Response;
  redirect(location: string): Response;
  /** Returns the caller session or throws 401. */
  requireSession(): Promise<AuthSession>;
}

export interface AuthEndpoint<TBody = undefined> {
  method: 'GET' | 'POST';
  /** Path relative to the base URL, e.g. `/sign-in/email` or `/callback/:id`. */
  path: string;
  body?: z.ZodType<TBody>;
  handler(ctx: EndpointContext<TBody>): Promise<Response>;
}

export function defineEndpoint<TBody = undefined>(
  endpoint: AuthEndpoint<TBody>,
): AuthEndpoint<TBody> {
  return endpoint;
}

/** Matches `/callback/:id` against `/callback/github`. */
export function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const expected = pattern.split('/');
  const actual = path.split('/');
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].startsWith(':')) {
      if (!actual[i]) return null;
      params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    } else if (expected[i] !== actual[i]) {
      return null;
    }
  }
  return params;
}
