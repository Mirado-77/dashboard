import { Module } from '@nestjs/common';
import { CredentialsCipher } from './credentials.service.js';
import { ServiceRegistry } from './registry/registry.js';
import { services } from './registry/services.js';

@Module({
  providers: [
    CredentialsCipher,
    {
      provide: ServiceRegistry,
      useFactory: () => new ServiceRegistry(services),
    },
  ],
  exports: [CredentialsCipher, ServiceRegistry],
})
export class ServicesModule {}
