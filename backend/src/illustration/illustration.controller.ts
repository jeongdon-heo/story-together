import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsNotEmpty, IsIn, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { IllustrationService } from './illustration.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const VALID_STYLES = ['crayon', 'watercolor', 'sketch', 'classic', 'cartoon', 'fantasy'];

class AnalyzeScenesDto {
  @IsUUID()
  storyId: string;
}

class GenerateIllustrationDto {
  @IsUUID()
  storyId: string;

  @IsNumber()
  sceneIndex: number;

  @IsNotEmpty()
  sceneText: string;

  @IsIn(VALID_STYLES)
  style: string;

  @IsOptional()
  @IsUUID()
  branchNodeId?: string;
}

class GenerateCoverDto {
  @IsUUID()
  storyId: string;

  @IsIn(VALID_STYLES)
  style: string;
}

@Controller('illustrations')
export class IllustrationController {
  constructor(private readonly illustrationService: IllustrationService) {}

  // 장면 분석
  @Post('analyze-scenes')
  async analyzeScenes(@Body() dto: AnalyzeScenesDto) {
    const scenes = await this.illustrationService.analyzeScenes(dto.storyId);
    return { data: { scenes } };
  }

  // 삽화 생성 (비동기)
  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(@Body() dto: GenerateIllustrationDto) {
    const result = await this.illustrationService.generateIllustration(
      dto.storyId,
      dto.sceneIndex,
      dto.sceneText,
      dto.style,
      dto.branchNodeId,
    );
    return { data: result };
  }

  // 표지 생성 (비동기)
  @Post('generate-cover')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateCover(@Body() dto: GenerateCoverDto) {
    const result = await this.illustrationService.generateCover(dto.storyId, dto.style);
    return { data: result };
  }

  // 이야기 삽화 목록 조회
  @Get('story/:storyId')
  async getStoryIllustrations(@Param('storyId') storyId: string) {
    const illustrations = await this.illustrationService.getStoryIllustrations(storyId);
    return { data: { illustrations } };
  }

  // 삽화 삭제
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.illustrationService.deleteIllustration(id, user.id);
    return { data: result };
  }

  // 삽화 재생성
  @Post(':id/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  async regenerate(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.illustrationService.regenerateIllustration(id, user.id);
    return { data: result };
  }
}
