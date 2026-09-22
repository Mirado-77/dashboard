import { z } from 'zod';
import { defineEndpoint } from '../endpoint.js';
import { Errors } from '../errors.js';
import { CREDENTIAL_PROVIDER } from '../context.js';
import { assertPasswordLength } from './email-password.js';

export const requestPasswordReset = defineEndpoint({
  method: 'POST',
  path: '/request-password-reset',
  body: z.object({
    email: z.email().trim().toLowerCase(),
    callbackURL: z.string().optional(),
  }),
  async handler({ body, auth, json }) {
    auth.assertCallbackURL(body.callbackURL);
    const user = await auth.store.users.findByEmail(body.email);

    if (!user) return json({ status: true });

    const account = await auth.store.accounts.findByUser(
      user.id,
      CREDENTIAL_PROVIDER,
    );

    if (account) {
      await auth.sendResetPassword(user, body.callbackURL);
    }

    return json({ status: true });
  },
});

export const resetPassword = defineEndpoint({
  method: 'POST',
  path: '/reset-password',
  body: z.object({
    token: z.string(),
    newPassword: z.string(),
  }),
  async handler({ body, auth, json }) {
    const token = body.token;
    if (!token) throw Errors.invalidToken();

    assertPasswordLength(auth, body.newPassword);
    const userId = await auth.consumeResetPasswordToken(token);
    const account = await auth.store.accounts.findByUser(
      userId,
      CREDENTIAL_PROVIDER,
    );

    if (!account) throw Errors.accountHasNoPassword();

    const newPasswordHash = await auth.hasher.hash(body.newPassword);
    await auth.store.accounts.update(account.id, { password: newPasswordHash });
    await auth.store.sessions.deleteByUser(userId);

    return json({ status: true });
  },
});
