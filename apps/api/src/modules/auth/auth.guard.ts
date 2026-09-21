import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_INSTANCE, type AuthInstance, type UserRole } from './auth.contract.js';
import { IS_PUBLIC_KEY, ROLES_KEY, type RequestWithAuth } from './auth.decorators.js';
import { toWebHeaders } from './node-bridge.js';

/** Global guard: every route requires a session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_INSTANCE) private readonly auth: AuthInstance,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & RequestWithAuth>();
    const session = await this.auth.api.getSession({ headers: toWebHeaders(request) });
    if (!session) throw new UnauthorizedException();
    request.auth = session;

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets);
    if (roles?.length && !roles.includes(session.user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
