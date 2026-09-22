import type { ProviderAccessToken } from '../../auth.contract.js';
import type { AuthContext } from '../context.js';
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

async function refresh(
  auth: AuthContext,
  account: AccountRecord,
): Promise<ProviderAccessToken> {
  const provider = auth.options.socialProviders?.find(
    (p) => p.id === account.providerId,
  );
  if (!provider?.refreshAccessToken || !account.refreshToken) {
    throw new Error(`Cannot refresh ${account.providerId} token`);
  }
  const tokens = await provider.refreshAccessToken(
    auth.secretBox.decrypt(account.refreshToken),
  );
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
