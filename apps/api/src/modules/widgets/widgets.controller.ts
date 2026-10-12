import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentSession } from '../auth/auth.decorators.js';
import { type AuthSession } from '../auth/auth.contract.js';
import { WidgetsService } from './widgets.service.js';

export const widgetIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      code: 'INVALID_WIDGET_ID',
      message: 'The widget id must be a UUID',
    }),
});

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
    @Param('id', widgetIdPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.widgets.update(session.user.id, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentSession() session: AuthSession,
    @Param('id', widgetIdPipe) id: string,
  ) {
    await this.widgets.remove(session.user.id, id);
    return { success: true };
  }

  @Get(':id/data')
  data(
    @CurrentSession() session: AuthSession,
    @Param('id', widgetIdPipe) id: string,
  ) {
    return this.widgets.data(session.user.id, id);
  }
}
