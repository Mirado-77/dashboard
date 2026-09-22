import { createOAuth2Provider, type OAuthProvider } from '../provider.js';

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export function google(options: {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}): OAuthProvider {
  return createOAuth2Provider({
    id: 'google',
    name: 'Google',
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: options.scopes ?? ['openid', 'email', 'profile'],
    // Needed to receive a refresh token, widgets call Google APIs later.
    authorizationParams: {
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
    },
    async getUserInfo({ accessToken }) {
      const response = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      );
      if (!response.ok)
        throw new Error(`Google userinfo request failed: ${response.status}`);
      const info = (await response.json()) as GoogleUserInfo;
      return {
        id: info.sub,
        email: info.email ?? null,
        emailVerified: info.email_verified ?? false,
        name: info.name ?? info.email ?? 'Google user',
        image: info.picture ?? null,
      };
    },
  });
}
