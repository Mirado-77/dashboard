import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_INSTANCE, type AuthInstance } from './auth.contract.js';
import { Public } from './auth.decorators.js';
import { sendWebResponse, toWebRequest } from './node-bridge.js';

/** Forwards every /api/auth/* request to the auth implementation. */
@Public()
@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance) {}

  @All('{*path}')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    await sendWebResponse(res, await this.auth.handler(toWebRequest(req)));
  }
}
