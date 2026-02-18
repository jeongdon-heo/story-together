import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RelayService } from './relay.service';
import { BranchService } from './branch.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { StickerModule } from '../sticker/sticker.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    StickerModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [RealtimeGateway, RelayService, BranchService],
  exports: [RelayService, BranchService],
})
export class RealtimeModule {}
