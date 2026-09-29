import { Module } from '@nestjs/common';
import { CredentialsCipher } from './credentials.service.js';
import { ProviderTokens } from './provider-tokens.service.js';
import { ServiceRegistry } from './registry/registry.js';
import { services } from './registry/services.js';
import { ServicesController } from './services.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  controllers: [ServicesController],
  providers: [
    CredentialsCipher,
    ProviderTokens,
    SubscriptionsService,
    {
      provide: ServiceRegistry,
      useFactory: () => new ServiceRegistry(services),
    },
  ],
  exports: [
    CredentialsCipher,
    ProviderTokens,
    ServiceRegistry,
    SubscriptionsService,
  ],
})
export class ServicesModule {}
