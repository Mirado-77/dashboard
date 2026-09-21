import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthSession, UserRole } from './auth.contract.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Opens a route to unauthenticated callers. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the listed roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export type RequestWithAuth = { auth?: AuthSession | null };

/** Injects the current session. Always null on @Public() routes. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthSession | null =>
    ctx.switchToHttp().getRequest<RequestWithAuth>().auth ?? null,
);
