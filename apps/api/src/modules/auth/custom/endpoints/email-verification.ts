import { z } from 'zod';
import { defineEndpoint } from '../endpoint.js';
import { AuthError, Errors } from '../errors.js';
import { callbackURL, email } from './schemas.js';

export const sendVerificationEmail = defineEndpoint({
  method: 'POST',
  path: '/send-verification-email',
  body: z.strictObject({ email, callbackURL }),
  async handler({ body, auth, json }) {
    auth.assertCallbackURL(body.callbackURL);
    const user = await auth.store.users.findByEmail(body.email);
    if (user && !user.emailVerified) {
      await auth.sendVerificationEmail(user, body.callbackURL);
    }
    // Same answer whether the account exists or not.
    return json({ status: true });
  },
});

export const verifyEmail = defineEndpoint({
  method: 'GET',
  path: '/verify-email',
  async handler({ url, auth, request, json, redirect, responseHeaders }) {
    const token = url.searchParams.get('token');
    const callbackURL = url.searchParams.get('callbackURL') ?? undefined;
    auth.assertCallbackURL(callbackURL);

    try {
      if (!token) throw Errors.invalidToken();
      const userId = await auth.consumeVerificationToken(token);
      const user = await auth.store.users.update(userId, {
        emailVerified: true,
      });
      if (!user) throw Errors.invalidToken();

      if (auth.options.emailVerification?.autoSignInAfterVerification) {
        responseHeaders.append(
          'set-cookie',
          await auth.createSession(user, request),
        );
      }
      return callbackURL ? redirect(callbackURL) : json({ status: true, user });
    } catch (error) {
      if (callbackURL && error instanceof AuthError) {
        const separator = callbackURL.includes('?') ? '&' : '?';
        return redirect(`${callbackURL}${separator}error=${error.code}`);
      }
      throw error;
    }
  },
});
