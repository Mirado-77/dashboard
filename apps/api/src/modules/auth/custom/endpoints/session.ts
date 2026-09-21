import { defineEndpoint } from '../endpoint.js';

export const getSession = defineEndpoint({
  method: 'GET',
  path: '/get-session',
  async handler({ auth, request, json, responseHeaders }) {
    const result = await auth.getSession(request.headers);
    if (!result) return json(null);
    if (result.refreshedCookie) {
      responseHeaders.append('set-cookie', result.refreshedCookie);
    }
    return json(result.data);
  },
});

export const signOut = defineEndpoint({
  method: 'POST',
  path: '/sign-out',
  async handler({ auth, request, json, responseHeaders }) {
    await auth.deleteSession(request.headers);
    responseHeaders.append('set-cookie', auth.clearSessionCookie());
    return json({ success: true });
  },
});
