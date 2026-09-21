import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/auth.decorators.js';

@Public()
@Controller()
export class AboutController {
  @Get('about.json')
  about(@Req() req: Request) {
    return {
      client: { host: req.ip?.replace(/^::ffff:/, '') ?? null },
      server: {
        current_time: Math.floor(Date.now() / 1000),
        // Filled by the service registry once services exist.
        services: [],
      },
    };
  }
}
