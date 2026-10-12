import { z } from 'zod';
import type { AuthSession } from '../../auth.contract.js';
import { defineEndpoint, type EndpointContext } from '../endpoint.js';
import { AuthError, Errors } from '../errors.js';
import type { AuthPlugin } from '../plugin.js';

export interface AdminOptions {
  /** Users with these emails become admins on their next sign in. */
  adminEmails?: string[];
}

async function requireAdmin(
  ctx: EndpointContext<unknown>,
): Promise<AuthSession> {
  const session = await ctx.requireSession();
  if (session.user.role !== 'admin') throw Errors.forbidden();
  return session;
}

const targetBody = z.strictObject({ userId: z.string().min(1).max(100) });

/** Refuses actions an admin could use to lock themselves out. */
function assertNotSelf(session: AuthSession, userId: string) {
  if (session.user.id === userId) {
    throw new AuthError(
      400,
      'CANNOT_TARGET_SELF',
      'You cannot perform this action on your own account',
    );
  }
}

async function findTarget(ctx: EndpointContext<unknown>, userId: string) {
  const user = await ctx.auth.store.users.findById(userId);
  if (!user) throw new AuthError(404, 'USER_NOT_FOUND', 'User not found');
  return user;
}

export function admin(options: AdminOptions = {}): AuthPlugin {
  const adminEmails = new Set(
    (options.adminEmails ?? []).map((e) => e.toLowerCase()),
  );

  return {
    id: 'admin',
    hooks: {
      async sessionCreate(user, auth) {
        if (user.role !== 'admin' && adminEmails.has(user.email)) {
          return (
            (await auth.store.users.update(user.id, { role: 'admin' })) ?? user
          );
        }
      },
    },
    endpoints: [
      defineEndpoint({
        method: 'GET',
        path: '/admin/list-users',
        async handler(ctx) {
          await requireAdmin(ctx);
          const query = z
            .strictObject({
              search: z.string().trim().max(100).optional(),
              limit: z.coerce.number().int().min(1).max(100).default(20),
              offset: z.coerce.number().int().min(0).default(0),
            })
            .safeParse(Object.fromEntries(ctx.url.searchParams));
          if (!query.success) throw Errors.invalidBody('Invalid query');
          const result = await ctx.auth.store.users.list(query.data);
          return ctx.json({
            ...result,
            limit: query.data.limit,
            offset: query.data.offset,
          });
        },
      }),
      defineEndpoint({
        method: 'POST',
        path: '/admin/set-role',
        body: targetBody.extend({ role: z.enum(['user', 'admin']) }),
        async handler(ctx) {
          assertNotSelf(await requireAdmin(ctx), ctx.body.userId);
          await findTarget(ctx, ctx.body.userId);
          const user = await ctx.auth.store.users.update(ctx.body.userId, {
            role: ctx.body.role,
          });
          return ctx.json({ user });
        },
      }),
      defineEndpoint({
        method: 'POST',
        path: '/admin/ban-user',
        body: targetBody.extend({
          banReason: z.string().trim().max(500).optional(),
        }),
        async handler(ctx) {
          assertNotSelf(await requireAdmin(ctx), ctx.body.userId);
          await findTarget(ctx, ctx.body.userId);
          const user = await ctx.auth.store.users.update(ctx.body.userId, {
            banned: true,
            banReason: ctx.body.banReason || null,
          });
          await ctx.auth.store.sessions.deleteByUser(ctx.body.userId);
          return ctx.json({ user });
        },
      }),
      defineEndpoint({
        method: 'POST',
        path: '/admin/unban-user',
        body: targetBody,
        async handler(ctx) {
          await requireAdmin(ctx);
          await findTarget(ctx, ctx.body.userId);
          const user = await ctx.auth.store.users.update(ctx.body.userId, {
            banned: false,
            banReason: null,
          });
          return ctx.json({ user });
        },
      }),
      defineEndpoint({
        method: 'POST',
        path: '/admin/revoke-user-sessions',
        body: targetBody,
        async handler(ctx) {
          await requireAdmin(ctx);
          await findTarget(ctx, ctx.body.userId);
          await ctx.auth.store.sessions.deleteByUser(ctx.body.userId);
          return ctx.json({ success: true });
        },
      }),
      defineEndpoint({
        method: 'POST',
        path: '/admin/remove-user',
        body: targetBody,
        async handler(ctx) {
          assertNotSelf(await requireAdmin(ctx), ctx.body.userId);
          await findTarget(ctx, ctx.body.userId);
          await ctx.auth.store.users.delete(ctx.body.userId);
          return ctx.json({ success: true });
        },
      }),
    ],
  };
}
