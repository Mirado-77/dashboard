import { Module } from '@nestjs/common';
import { WidgetsController } from './widgets.controller.js';
import { WidgetsService } from './widgets.service.js';
import { ServicesModule } from '../services/services.module.js';

@Module({
  controllers: [WidgetsController],
  providers: [WidgetsService],
  imports: [ServicesModule],
  exports: [],
})
export class WidgetsModule {}
