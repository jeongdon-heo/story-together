import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { StudentAccountModule } from './student-account/student-account.module';
import { ClassModule } from './class/class.module';
import { AiModule } from './ai/ai.module';
import { SessionModule } from './session/session.module';
import { StoryModule } from './story/story.module';
import { RealtimeModule } from './realtime/realtime.module';
import { IntroModule } from './intro/intro.module';
import { IllustrationModule } from './illustration/illustration.module';
import { AudioModule } from './audio/audio.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StickerModule } from './sticker/sticker.module';
import { ExportModule } from './export/export.module';
import { PublishModule } from './publish/publish.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    StudentAccountModule,
    ClassModule,
    AiModule,
    SessionModule,
    StoryModule,
    RealtimeModule,
    IntroModule,
    IllustrationModule,
    AudioModule,
    AnalyticsModule,
    StickerModule,
    ExportModule,
    PublishModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
