import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ServiceRegistry } from '../services/registry/registry.js';
import type { Service } from '../services/registry/types.js';
import { Public } from '../auth/auth.decorators.js';

/** Shape imposed by the subject, unrelated to how services are declared. */
function toAboutService(service: Service) {
  return {
    name: service.id,
    widgets: service.widgets.map((widget) => ({
      name: widget.id,
      description: widget.description,
      params: widget.params.map((param) => ({
        name: param.name,
        type: param.type,
      })),
    })),
  };
}

@Public()
@Controller()
export class AboutController {
  constructor(private readonly registry: ServiceRegistry) {}

  @Get('about.json')
  about(@Req() req: Request) {
    return {
      client: { host: req.ip?.replace(/^::ffff:/, '') ?? null },
      server: {
        current_time: Math.floor(Date.now() / 1000),
        services: this.registry.getAll().map(toAboutService),
      },
    };
  }
}
