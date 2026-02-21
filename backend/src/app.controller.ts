import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  healthCheck() {
    return {
      data: {
        status: 'ok',
        service: 'story-together-api',
        version: '2.2.0',
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Get('health/live')
  liveness() {
    return { data: { status: 'ok' } };
  }

  @Public()
  @Get('health/ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { data: { status: 'ok', database: 'connected' } };
    } catch {
      return { data: { status: 'error', database: 'disconnected' } };
    }
  }
}
