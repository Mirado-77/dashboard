import { createOAuth2Provider, type OAuthProvider } from '../provider.js';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export function github(options: {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}): OAuthProvider {
  return createOAuth2Provider({
    id: 'github',
    name: 'GitHub',
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    scopes: options.scopes ?? ['read:user', 'user:email'],
    async getUserInfo({ accessToken }) {
      const headers = {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'dashboard',
      };
      const userResponse = await fetch('https://api.github.com/user', { headers });
      if (!userResponse.ok) throw new Error(`GitHub user request failed: ${userResponse.status}`);
      const user = (await userResponse.json()) as GitHubUser;

      // The public profile email may be empty or unverified, the emails API is authoritative.
      const emailsResponse = await fetch('https://api.github.com/user/emails', { headers });
      const emails = emailsResponse.ok ? ((await emailsResponse.json()) as GitHubEmail[]) : [];
      const primary = emails.find((e) => e.primary) ?? emails.find((e) => e.email === user.email);

      return {
        id: String(user.id),
        email: primary?.email ?? user.email,
        emailVerified: primary?.verified ?? false,
        name: user.name ?? user.login,
        image: user.avatar_url,
      };
    },
  });
}
