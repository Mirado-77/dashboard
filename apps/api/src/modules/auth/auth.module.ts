import {
  Global,
  Module,
  type DynamicModule,
  type ModuleMetadata,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AUTH_INSTANCE, type AuthInstance } from './auth.contract.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';

export interface AuthModuleOptions {
  imports?: ModuleMetadata['imports'];
  inject?: any[];
  useFactory(...args: any[]): AuthInstance | Promise<AuthInstance>;
}

@Global()
@Module({})
export class AuthModule {
  static forRootAsync(options: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: options.imports,
      controllers: [AuthController],
      providers: [
        {
          provide: AUTH_INSTANCE,
          inject: options.inject,
          useFactory: options.useFactory,
        },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
      exports: [AUTH_INSTANCE],
    };
  }
}
