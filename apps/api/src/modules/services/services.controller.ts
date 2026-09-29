import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import type { AuthSession } from '../auth/auth.contract.js';
import { CurrentSession } from '../auth/auth.decorators.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Controller('services')
export class ServicesController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(@CurrentSession() session: AuthSession) {
    return this.subscriptions.list(session.user.id);
  }

  @Post(':id/subscribe')
  subscribe(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.subscriptions.subscribe(session.user.id, id, body);
  }

  @Delete(':id/subscribe')
  async unsubscribe(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
  ) {
    await this.subscriptions.unsubscribe(session.user.id, id);
    return { success: true };
  }
}
