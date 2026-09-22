import type { AuthSessionRecord, AuthUser } from '../../auth.contract.js';
import type { AccountRecord, AuthStore, VerificationRecord } from './store.js';

/** In-memory store for tests. Not for production use. */
export function memoryStore(): AuthStore {
  const users = new Map<string, AuthUser>();
  const accounts = new Map<string, AccountRecord>();
  const sessions = new Map<string, AuthSessionRecord & { tokenHash: string }>();
  const verifications = new Map<string, VerificationRecord>();
  const stamp = () => ({ createdAt: new Date(), updatedAt: new Date() });

  const store: AuthStore = {
    users: {
      async create(data) {
        if ([...users.values()].some((u) => u.email === data.email)) {
          throw new Error('unique violation: user.email');
        }
        const user = { ...data, ...stamp() };
        users.set(user.id, user);
        return { ...user };
      },
      async findById(id) {
        const user = users.get(id);
        return user ? { ...user } : null;
      },
      async findByEmail(email) {
        const user = [...users.values()].find((u) => u.email === email);
        return user ? { ...user } : null;
      },
      async update(id, patch) {
        const user = users.get(id);
        if (!user) return null;
        Object.assign(user, patch, { updatedAt: new Date() });
        return { ...user };
      },
      async list({ search, limit, offset }) {
        const term = search?.toLowerCase();
        const matching = [...users.values()]
          .filter(
            (u) =>
              !term ||
              u.email.toLowerCase().includes(term) ||
              u.name.toLowerCase().includes(term),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return {
          users: matching.slice(offset, offset + limit).map((u) => ({ ...u })),
          total: matching.length,
        };
      },
      async delete(id) {
        users.delete(id);
        for (const [key, a] of accounts) if (a.userId === id) accounts.delete(key);
        for (const [key, s] of sessions) if (s.userId === id) sessions.delete(key);
      },
    },
    accounts: {
      async create(data) {
        if (
          [...accounts.values()].some(
            (a) => a.providerId === data.providerId && a.accountId === data.accountId,
          )
        ) {
          throw new Error('unique violation: account.provider_account');
        }
        const account = { ...data, ...stamp() };
        accounts.set(account.id, account);
        return { ...account };
      },
      async findByUser(userId, providerId) {
        const account = [...accounts.values()].find(
          (a) => a.userId === userId && a.providerId === providerId,
        );
        return account ? { ...account } : null;
      },
      async findByProvider(providerId, accountId) {
        const account = [...accounts.values()].find(
          (a) => a.providerId === providerId && a.accountId === accountId,
        );
        return account ? { ...account } : null;
      },
      async listByUser(userId) {
        return [...accounts.values()]
          .filter((a) => a.userId === userId)
          .map((a) => ({ ...a }));
      },
      async update(id, patch) {
        const account = accounts.get(id);
        if (account) Object.assign(account, patch, { updatedAt: new Date() });
      },
      async delete(id) {
        accounts.delete(id);
      },
    },
    sessions: {
      async create(data) {
        const session = { ...data, ...stamp() };
        sessions.set(session.id, session);
        const { tokenHash: _tokenHash, ...record } = session;
        return record;
      },
      async findByTokenHash(tokenHash) {
        const found = [...sessions.values()].find(
          (s) => s.tokenHash === tokenHash,
        );
        const user = found && users.get(found.userId);
        if (!found || !user) return null;
        const { tokenHash: _tokenHash, ...session } = found;
        return { session, user: { ...user } };
      },
      async update(id, patch) {
        const session = sessions.get(id);
        if (session) Object.assign(session, patch, { updatedAt: new Date() });
      },
      async deleteByTokenHash(tokenHash) {
        for (const [id, s] of sessions) {
          if (s.tokenHash === tokenHash) sessions.delete(id);
        }
      },
      async deleteByUser(userId) {
        for (const [id, s] of sessions) {
          if (s.userId === userId) sessions.delete(id);
        }
      },
      async deleteByUserExcept(userId, sessionId) {
        for (const [id, s] of sessions) {
            if ((s.userId === userId) && (s.id !== sessionId)) {
                sessions.delete(id);
            }
        }
      },
    },
    verifications: {
      async create(data) {
        const verification = { ...data, ...stamp() };
        verifications.set(verification.id, verification);
        return { ...verification };
      },
      async findByIdentifier(identifier) {
        const found = [...verifications.values()].find(
          (v) => v.identifier === identifier,
        );
        return found ? { ...found } : null;
      },
      async deleteById(id) {
        verifications.delete(id);
      },
    },
    transaction: (fn) => fn(store),
  };
  return store;
}
