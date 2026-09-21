import type {
  AuthSession,
  AuthSessionRecord,
  AuthUser,
} from '../../auth.contract.js';

export interface AccountRecord {
  id: string;
  userId: string;
  providerId: string;
  accountId: string;
  password: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationRecord {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

type Insert<T> = Omit<T, 'createdAt' | 'updatedAt'>;
type Patch<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

export type NewUser = Insert<AuthUser>;
export type NewAccount = Insert<AccountRecord>;
export type NewSession = Insert<AuthSessionRecord> & { tokenHash: string };
export type NewVerification = Insert<VerificationRecord>;

/**
 * Persistence port of the auth system. The core never touches an ORM directly,
 * so the storage can change without touching endpoints.
 */
export interface AuthStore {
  users: {
    create(data: NewUser): Promise<AuthUser>;
    findById(id: string): Promise<AuthUser | null>;
    findByEmail(email: string): Promise<AuthUser | null>;
    update(id: string, patch: Patch<AuthUser>): Promise<AuthUser | null>;
    list(query: {
      search?: string;
      limit: number;
      offset: number;
    }): Promise<{ users: AuthUser[]; total: number }>;
    delete(id: string): Promise<void>;
  };
  accounts: {
    create(data: NewAccount): Promise<AccountRecord>;
    findByUser(userId: string, providerId: string): Promise<AccountRecord | null>;
    findByProvider(providerId: string, accountId: string): Promise<AccountRecord | null>;
    listByUser(userId: string): Promise<AccountRecord[]>;
    update(id: string, patch: Patch<AccountRecord>): Promise<void>;
    delete(id: string): Promise<void>;
  };
  sessions: {
    create(data: NewSession): Promise<AuthSessionRecord>;
    findByTokenHash(tokenHash: string): Promise<AuthSession | null>;
    update(id: string, patch: Patch<AuthSessionRecord>): Promise<void>;
    deleteByTokenHash(tokenHash: string): Promise<void>;
    deleteByUser(userId: string): Promise<void>;
  };
  verifications: {
    create(data: NewVerification): Promise<VerificationRecord>;
    findByIdentifier(identifier: string): Promise<VerificationRecord | null>;
    deleteById(id: string): Promise<void>;
  };
  transaction<T>(fn: (store: AuthStore) => Promise<T>): Promise<T>;
}
