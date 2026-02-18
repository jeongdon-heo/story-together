import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  healthCheck() {
    return {
      data: {
        status: 'ok',
        service: 'story-together-api',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
