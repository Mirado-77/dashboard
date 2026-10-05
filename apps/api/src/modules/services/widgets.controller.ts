import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthSession } from '../auth/auth.contract.js';
import { CurrentSession } from '../auth/auth.decorators.js';
import { WidgetsService } from './widgets.service.js';

@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgets: WidgetsService) {}

  @Get()
  list(@CurrentSession() session: AuthSession) {
    return this.widgets.list(session.user.id);
  }

  @Post()
  create(@CurrentSession() session: AuthSession, @Body() body: unknown) {
    return this.widgets.create(session.user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.widgets.update(session.user.id, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
  ) {
    await this.widgets.remove(session.user.id, id);
    return { success: true };
  }

  @Get(':id/data')
  data(@CurrentSession() session: AuthSession, @Param('id') id: string) {
    return this.widgets.data(session.user.id, id);
  }
}
