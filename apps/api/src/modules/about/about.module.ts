import { Module } from '@nestjs/common';
import { AboutController } from './about.controller.js';

@Module({ controllers: [AboutController] })
export class AboutModule {}
