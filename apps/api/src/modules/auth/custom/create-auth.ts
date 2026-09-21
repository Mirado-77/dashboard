import type { AuthInstance } from '../auth.contract.js';
import {
  createContext,
  getClientIp,
  isTrustedOrigin,
  type AuthContext,
} from './context.js';
import { matchPath, type AuthEndpoint, type EndpointContext } from './endpoint.js';
import {
  sendVerificationEmail,
  verifyEmail,
} from './endpoints/email-verification.js';
import { signInEmail, signUpEmail } from './endpoints/email-password.js';
import { getSession, signOut } from './endpoints/session.js';
import {
  linkSocial,
  listAccounts,
  listProviders,
  oauthCallback,
  signInSocial,
  unlinkAccount,
} from './endpoints/social.js';
import { getAccessToken } from './oauth/tokens.js';
import { AuthError, Errors } from './errors.js';
import type { AuthOptions } from './options.js';
import type { HookContext } from './plugin.js';
import { memoryRateLimiter } from './rate-limit.js';

function coreEndpoints(options: AuthOptions): AuthEndpoint<any>[] {
  const endpoints: AuthEndpoint<any>[] = [getSession, signOut];
  if (options.emailAndPassword?.enabled) endpoints.push(signUpEmail, signInEmail);
  if (options.emailVerification) endpoints.push(sendVerificationEmail, verifyEmail);
  endpoints.push(listProviders, listAccounts, unlinkAccount);
  if (options.socialProviders?.length) {
    endpoints.push(signInSocial, linkSocial, oauthCallback);
  }
  return endpoints;
}

function assertTrustedOrigin(auth: AuthContext, request: Request) {
  const origin =
    request.headers.get('origin') ??
    (request.headers.get('referer') ? new URL(request.headers.get('referer')!).origin : null);
  // Requests without cookie nor origin (server to server) carry no CSRF risk.
  if (!origin && !request.headers.has('cookie')) return;
  if (!origin || !isTrustedOrigin(auth, origin)) throw Errors.untrustedOrigin();
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new AuthError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected application/json');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw Errors.invalidBody('Malformed JSON');
  }
}

export function createAuth(options: AuthOptions): AuthInstance {
  const auth = createContext(options);
  const plugins = options.plugins ?? [];
  const routes: AuthEndpoint<any>[] = [];
  for (const endpoint of [
    ...coreEndpoints(options),
    ...plugins.flatMap((plugin) => plugin.endpoints ?? []),
  ]) {
    if (routes.some((r) => r.method === endpoint.method && r.path === endpoint.path)) {
      throw new Error(`Duplicate auth endpoint: ${endpoint.method} ${endpoint.path}`);
    }
    routes.push(endpoint);
  }

  function findRoute(method: string, path: string) {
    for (const endpoint of routes) {
      if (endpoint.method !== method) continue;
      const params = matchPath(endpoint.path, path);
      if (params) return { endpoint, params };
    }
    return null;
  }
  const beforeHooks = plugins.flatMap((plugin) => plugin.hooks?.before ?? []);
  const afterHooks = plugins.flatMap((plugin) => plugin.hooks?.after ?? []);
  const rateLimit = { enabled: true, window: 60, max: 100, ...options.rateLimit };
  const limiter = memoryRateLimiter();

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${auth.basePath}/`)) throw Errors.notFound();
    const path = url.pathname.slice(auth.basePath.length);
    const route = findRoute(request.method, path);
    if (!route) throw Errors.notFound();
    const { endpoint, params } = route;

    if (request.method !== 'GET') assertTrustedOrigin(auth, request);

    if (rateLimit.enabled) {
      const rule = rateLimit.customRules?.[endpoint.path] ?? rateLimit;
      const key = `${getClientIp(request.headers) ?? 'unknown'}|${path}`;
      const retryAfter = limiter.consume(key, rule);
      if (retryAfter !== null) {
        const response = Errors.tooManyRequests(retryAfter).toResponse();
        response.headers.set('retry-after', String(retryAfter));
        return response;
      }
    }

    const hookContext: HookContext = { path, request, auth };
    for (const hook of beforeHooks) {
      if (!hook.matcher(hookContext)) continue;
      const response = await hook.handler(hookContext);
      if (response) return response;
    }

    let body: unknown;
    if (endpoint.body) {
      const parsed = endpoint.body.safeParse(
        request.method === 'GET' ? {} : await readBody(request),
      );
      if (!parsed.success) {
        throw Errors.invalidBody(parsed.error.issues.map((i) => i.message).join(', '));
      }
      body = parsed.data;
    }

    const responseHeaders = new Headers();
    const withHeaders = (response: Response) => {
      for (const [name, value] of responseHeaders) {
        if (name !== 'set-cookie') response.headers.set(name, value);
      }
      for (const value of responseHeaders.getSetCookie()) {
        response.headers.append('set-cookie', value);
      }
      return response;
    };
    const context: EndpointContext<unknown> = {
      request,
      url,
      params,
      body,
      auth,
      responseHeaders,
      json: (data, status = 200) => withHeaders(Response.json(data, { status })),
      redirect: (location) =>
        withHeaders(new Response(null, { status: 302, headers: { location } })),
      async requireSession() {
        const session = await auth.getSession(request.headers);
        if (!session) throw Errors.unauthorized();
        return session.data;
      },
    };

    let response = await endpoint.handler(context);
    for (const hook of afterHooks) {
      if (!hook.matcher(hookContext)) continue;
      response = (await hook.handler(hookContext, response)) ?? response;
    }
    return response;
  }

  return {
    async handler(request) {
      try {
        return await handle(request);
      } catch (error) {
        if (error instanceof AuthError) return error.toResponse();
        auth.logger.error('[auth] unexpected error', error);
        return Response.json(
          { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
          { status: 500 },
        );
      }
    },
    api: {
      async getSession({ headers }) {
        return (await auth.getSession(headers))?.data ?? null;
      },
      getAccessToken: ({ userId, providerId }) => getAccessToken(auth, userId, providerId),
    },
  };
}
