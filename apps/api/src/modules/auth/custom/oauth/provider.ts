import { codeChallenge } from '../crypto.js';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scopes: string[];
}

export interface OAuthUserInfo {
  /** Stable id of the user at the provider. */
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  image: string | null;
}

/**
 * A third-party identity or API provider. Implement it directly, or use
 * `createOAuth2Provider` for standard authorization code providers.
 */
export interface OAuthProvider {
  id: string;
  name: string;
  /** Link-only provider: usable for services, not to sign in. */
  disableSignIn?: boolean;
  createAuthorizationURL(input: {
    state: string;
    codeVerifier: string;
    redirectURI: string;
    scopes?: string[];
  }): URL;
  validateAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
    redirectURI: string;
  }): Promise<OAuthTokens>;
  getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo>;
  refreshAccessToken?(refreshToken: string): Promise<OAuthTokens>;
}

export interface OAuth2ProviderConfig {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  /** Scopes always requested. */
  scopes: string[];
  scopeSeparator?: string;
  authorizationParams?: Record<string, string>;
  pkce?: boolean;
  disableSignIn?: boolean;
  /** False for providers issuing tokens that never expire, such as GitHub. */
  supportsRefresh?: boolean;
  getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo>;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

function inSeconds(seconds: number | undefined): Date | null {
  return seconds ? new Date(Date.now() + seconds * 1000) : null;
}

export function createOAuth2Provider(
  config: OAuth2ProviderConfig,
): OAuthProvider {
  const separator = config.scopeSeparator ?? ' ';

  async function requestToken(
    params: Record<string, string>,
  ): Promise<OAuthTokens> {
    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        ...params,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok || data.error || !data.access_token) {
      throw new Error(
        `${config.id} token request failed: ${data.error ?? response.status} ${data.error_description ?? ''}`.trim(),
      );
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      idToken: data.id_token ?? null,
      accessTokenExpiresAt: inSeconds(data.expires_in),
      refreshTokenExpiresAt: inSeconds(data.refresh_token_expires_in),
      scopes: data.scope ? data.scope.split(/[ ,]+/).filter(Boolean) : [],
    };
  }

  return {
    id: config.id,
    name: config.name,
    disableSignIn: config.disableSignIn,
    createAuthorizationURL({ state, codeVerifier, redirectURI, scopes = [] }) {
      const url = new URL(config.authorizationEndpoint);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', redirectURI);
      url.searchParams.set('state', state);
      url.searchParams.set(
        'scope',
        [...new Set([...config.scopes, ...scopes])].join(separator),
      );
      if (config.pkce ?? true) {
        url.searchParams.set('code_challenge', codeChallenge(codeVerifier));
        url.searchParams.set('code_challenge_method', 'S256');
      }
      for (const [key, value] of Object.entries(
        config.authorizationParams ?? {},
      )) {
        url.searchParams.set(key, value);
      }
      return url;
    },
    validateAuthorizationCode({ code, codeVerifier, redirectURI }) {
      return requestToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectURI,
        ...((config.pkce ?? true) ? { code_verifier: codeVerifier } : {}),
      });
    },
    getUserInfo: config.getUserInfo,
    ...((config.supportsRefresh ?? true)
      ? {
          refreshAccessToken(refreshToken: string) {
            return requestToken({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
            });
          },
        }
      : {}),
  };
}
