import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module.js';
import { AboutController } from './about.controller.js';

@Module({ imports: [ServicesModule], controllers: [AboutController] })
export class AboutModule {}
