import { and, count, desc, eq, ilike, not, or } from 'drizzle-orm';
import type { Database } from '../../../../database/database.module.js';
import {
  accounts,
  sessions,
  users,
  verifications,
} from '../../../../database/schema/index.js';
import type { AuthSessionRecord } from '../../auth.contract.js';
import type { AuthStore } from './store.js';

type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

function toSessionRecord(
  row: typeof sessions.$inferSelect,
): AuthSessionRecord {
  const { tokenHash: _tokenHash, ...session } = row;
  return session;
}

export function drizzleStore(db: Executor): AuthStore {
  const now = () => new Date();

  return {
    users: {
      async create(data) {
        const [user] = await db.insert(users).values(data).returning();
        return user;
      },
      async findById(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user ?? null;
      },
      async findByEmail(email) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email));
        return user ?? null;
      },
      async update(id, patch) {
        const [user] = await db
          .update(users)
          .set({ ...patch, updatedAt: now() })
          .where(eq(users.id, id))
          .returning();
        return user ?? null;
      },
      async list({ search, limit, offset }) {
        const pattern = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : null;
        const where = pattern
          ? or(ilike(users.email, pattern), ilike(users.name, pattern))
          : undefined;
        const [rows, [{ total }]] = await Promise.all([
          db
            .select()
            .from(users)
            .where(where)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ total: count() }).from(users).where(where),
        ]);
        return { users: rows, total };
      },
      async delete(id) {
        await db.delete(users).where(eq(users.id, id));
      },
    },
    accounts: {
      async create(data) {
        const [account] = await db.insert(accounts).values(data).returning();
        return account;
      },
      async findByUser(userId, providerId) {
        const [account] = await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, userId),
              eq(accounts.providerId, providerId),
            ),
          );
        return account ?? null;
      },
      async findByProvider(providerId, accountId) {
        const [account] = await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.providerId, providerId),
              eq(accounts.accountId, accountId),
            ),
          );
        return account ?? null;
      },
      async listByUser(userId) {
        return db.select().from(accounts).where(eq(accounts.userId, userId));
      },
      async update(id, patch) {
        await db
          .update(accounts)
          .set({ ...patch, updatedAt: now() })
          .where(eq(accounts.id, id));
      },
      async delete(id) {
        await db.delete(accounts).where(eq(accounts.id, id));
      },
    },
    sessions: {
      async create(data) {
        const [session] = await db.insert(sessions).values(data).returning();
        return toSessionRecord(session);
      },
      async findByTokenHash(tokenHash) {
        const [row] = await db
          .select({ session: sessions, user: users })
          .from(sessions)
          .innerJoin(users, eq(users.id, sessions.userId))
          .where(eq(sessions.tokenHash, tokenHash));
        return row
          ? { session: toSessionRecord(row.session), user: row.user }
          : null;
      },
      async update(id, patch) {
        await db
          .update(sessions)
          .set({ ...patch, updatedAt: now() })
          .where(eq(sessions.id, id));
      },
      async deleteByTokenHash(tokenHash) {
        await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
      },
      async deleteByUser(userId) {
        await db.delete(sessions).where(eq(sessions.userId, userId));
      },
      async deleteByUserExcept(userId, sessionId) {
          await db.delete(sessions).where(and(eq(sessions.userId, userId), not(eq(sessions.id, sessionId))))
      },
    },
    verifications: {
      async create(data) {
        const [verification] = await db
          .insert(verifications)
          .values(data)
          .returning();
        return verification;
      },
      async findByIdentifier(identifier) {
        const [verification] = await db
          .select()
          .from(verifications)
          .where(eq(verifications.identifier, identifier));
        return verification ?? null;
      },
      async deleteById(id) {
        await db.delete(verifications).where(eq(verifications.id, id));
      },
    },
    transaction(fn) {
      if (!('transaction' in db)) return fn(drizzleStore(db));
      return (db as Database).transaction((tx) => fn(drizzleStore(tx)));
    },
  };
}
