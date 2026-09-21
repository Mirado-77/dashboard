import { Controller, Get } from '@nestjs/common';
import type { AuthSession } from '../auth/auth.contract.js';
import { CurrentSession } from '../auth/auth.decorators.js';

@Controller('users')
export class UsersController {
  @Get('me')
  me(@CurrentSession() session: AuthSession) {
    return session.user;
  }
}
