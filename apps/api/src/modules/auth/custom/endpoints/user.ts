import { z } from 'zod';
import { defineEndpoint } from '../endpoint.js';
import { Errors } from '../errors.js';
import { CREDENTIAL_PROVIDER } from '../context.js';
import { assertPasswordLength } from './email-password.js';

export const updateUser = defineEndpoint({
  method: 'POST',
  path: '/update-user',
  body: z.object({
    name: z.string().trim().min(1).max(100),
  }),
  async handler({ body, auth, json, requireSession }) {
    const { user } = await requireSession();
    const updated = await auth.store.users.update(user.id, { name: body.name });
    if (!updated) throw Errors.notFound();
    return json({ user: updated });
  },
});

export const updatePassword = defineEndpoint({
    method: 'POST',
    path: '/update-password',
    body: z.object({
        currentPassword: z.string(),
        newPassword: z.string(),
        revokeOtherSessions: z.boolean().optional(),
    }),
    async handler({ body, auth, json, requireSession }) {
        const { user, session } = await requireSession();
        assertPasswordLength(auth, body.newPassword);
        
        const account = await auth.store.accounts.findByUser(user.id, CREDENTIAL_PROVIDER)

        if (!account || !account.password)
            throw Errors.accountHasNoPassword()

        if (!(await auth.hasher.verify(body.currentPassword, account.password))) {
            throw Errors.invalidCredentials();
        }

        const passwordHash = await auth.hasher.hash(body.newPassword);
        await auth.store.accounts.update(account.id, { password: passwordHash });
        if (body.revokeOtherSessions)
            await auth.store.sessions.deleteByUserExcept(user.id, session.id)
        return json({ success: true });
    }
})
