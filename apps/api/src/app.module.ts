import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { AboutModule } from './modules/about/about.module.js';
import { authFactory } from './modules/auth/auth.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { ServicesModule } from './modules/services/services.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    AuthModule.forRootAsync({ imports: [MailModule], ...authFactory }),
    AboutModule,
    ServicesModule,
    UsersModule,
  ],
})
export class AppModule {}
