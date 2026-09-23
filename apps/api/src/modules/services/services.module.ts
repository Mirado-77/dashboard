import { Module } from '@nestjs/common';
import { ServiceRegistry } from './registry/registry.js';
import { services } from './registry/services.js';

@Module({
  providers: [
    {
      provide: ServiceRegistry,
      useFactory: () => new ServiceRegistry(services),
    },
  ],
  exports: [ServiceRegistry],
})
export class ServicesModule {}
