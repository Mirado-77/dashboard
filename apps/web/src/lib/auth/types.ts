// Mirrors apps/api/src/modules/auth/auth.contract.ts (dates are serialized).

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  role: UserRole;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  session: {
    id: string;
    userId: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  };
  user: User;
}

export interface Provider {
  id: string;
  name: string;
  signIn: boolean;
}

export interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
  scopes: string[];
  createdAt: string;
}

export interface UserList {
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuthErrorBody {
  code: string;
  message: string;
  status: number;
}

export type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: AuthErrorBody };

export const SESSION_COOKIE = "dashboard.session_token";
