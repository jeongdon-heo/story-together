import { Module } from '@nestjs/common';
import { StoryService } from './story.service';
import { StoryController } from './story.controller';
import { AiModule } from '../ai/ai.module';
import { StickerModule } from '../sticker/sticker.module';

@Module({
  imports: [AiModule, StickerModule],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
