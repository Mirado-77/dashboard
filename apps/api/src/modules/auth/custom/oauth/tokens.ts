import type { ProviderAccessToken } from '../../auth.contract.js';
import type { AuthContext } from '../context.js';
import { Errors } from '../errors.js';
import type { AccountRecord } from '../store/store.js';
import type { OAuthTokens } from './provider.js';

const EXPIRY_MARGIN_MS = 60_000;

/** Account columns for a set of tokens, encrypted at rest. */
export function encryptTokens(auth: AuthContext, tokens: OAuthTokens) {
  const seal = (value: string | null) =>
    value ? auth.secretBox.encrypt(value) : null;
  return {
    accessToken: seal(tokens.accessToken),
    refreshToken: seal(tokens.refreshToken),
    idToken: seal(tokens.idToken),
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    scope: tokens.scopes.join(',') || null,
  };
}

export function parseScopes(scope: string | null): string[] {
  return scope ? scope.split(',').filter(Boolean) : [];
}

const pendingRefreshes = new Map<string, Promise<ProviderAccessToken>>();

/**
 * Drops the tokens we know to be useless, so the next call asks the user to
 * reconnect instead of replaying a refresh that cannot succeed.
 */
async function forget(
  auth: AuthContext,
  account: AccountRecord,
): Promise<never> {
  await auth.store.accounts.update(account.id, {
    accessToken: null,
    accessTokenExpiresAt: null,
    refreshToken: null,
    refreshTokenExpiresAt: null,
  });
  throw Errors.providerReauthRequired(account.providerId);
}

async function refresh(
  auth: AuthContext,
  account: AccountRecord,
): Promise<ProviderAccessToken> {
  const provider = auth.options.socialProviders?.find(
    (p) => p.id === account.providerId,
  );
  if (!provider?.refreshAccessToken || !account.refreshToken) {
    return forget(auth, account);
  }

  let tokens: OAuthTokens;
  try {
    tokens = await provider.refreshAccessToken(
      auth.secretBox.decrypt(account.refreshToken),
    );
  } catch (error) {
    // Revoked, expired or rejected: only the user can fix it.
    auth.options.logger?.warn(
      `Refresh failed for ${account.providerId}: ${String(error)}`,
    );
    return forget(auth, account);
  }
  const columns = encryptTokens(auth, {
    ...tokens,
    // Providers often omit these on refresh, keep the previous values.
    scopes: tokens.scopes.length ? tokens.scopes : parseScopes(account.scope),
  });
  await auth.store.accounts.update(account.id, {
    ...columns,
    refreshToken: columns.refreshToken ?? account.refreshToken,
    refreshTokenExpiresAt:
      columns.refreshTokenExpiresAt ?? account.refreshTokenExpiresAt,
    idToken: columns.idToken ?? account.idToken,
  });
  return {
    accessToken: tokens.accessToken,
    expiresAt: tokens.accessTokenExpiresAt,
    scopes: parseScopes(columns.scope),
  };
}

export async function getAccessToken(
  auth: AuthContext,
  userId: string,
  providerId: string,
): Promise<ProviderAccessToken | null> {
  const account = await auth.store.accounts.findByUser(userId, providerId);
  if (!account?.accessToken) return null;

  const expired =
    account.accessTokenExpiresAt !== null &&
    account.accessTokenExpiresAt.getTime() - EXPIRY_MARGIN_MS <= Date.now();
  if (!expired) {
    return {
      accessToken: auth.secretBox.decrypt(account.accessToken),
      expiresAt: account.accessTokenExpiresAt,
      scopes: parseScopes(account.scope),
    };
  }

  // Concurrent widgets must not spend the same refresh token twice.
  let pending = pendingRefreshes.get(account.id);
  if (!pending) {
    pending = refresh(auth, account).finally(() =>
      pendingRefreshes.delete(account.id),
    );
    pendingRefreshes.set(account.id, pending);
  }
  return pending;
}
