import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsBoolean, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ExportService } from './export.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

class ExportPdfDto {
  @IsUUID()
  storyId: string;

  @IsOptional()
  @IsBoolean()
  includeIllustrations?: boolean;

  @IsOptional()
  @IsBoolean()
  includeFeedback?: boolean;
}

class ExportCollectionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  storyIds: string[];

  @IsOptional()
  @IsString()
  title?: string;
}

class ExportAudioDto {
  @IsUUID()
  storyId: string;

  @IsOptional()
  @IsString()
  voiceStyle?: string;

}

class ExportVideoDto {
  @IsUUID()
  storyId: string;

  @IsOptional()
  @IsString()
  voiceStyle?: string;

  @IsOptional()
  @IsBoolean()
  includeIllustrations?: boolean;
}

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  // PDF 내보내기 (단일)
  @Post('pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  async exportPdf(@Body() dto: ExportPdfDto) {
    const data = await this.exportService.exportPdf(dto.storyId, {
      includeIllustrations: dto.includeIllustrations,
      includeFeedback: dto.includeFeedback,
    });
    return { data };
  }

  // 문집 내보내기 (교사)
  @Post('pdf/collection')
  @Roles('teacher')
  @HttpCode(HttpStatus.ACCEPTED)
  async exportCollection(@Body() dto: ExportCollectionDto) {
    const data = await this.exportService.exportCollection(
      dto.storyIds,
      dto.title || '동화 모음집',
    );
    return { data };
  }

  // 오디오 내보내기
  @Post('audio')
  @HttpCode(HttpStatus.ACCEPTED)
  async exportAudio(@Body() dto: ExportAudioDto) {
    const data = await this.exportService.exportAudio(dto.storyId, {
      voiceStyle: dto.voiceStyle,
    });
    return { data };
  }

  // 영상 내보내기 (placeholder)
  @Post('video')
  @HttpCode(HttpStatus.ACCEPTED)
  async exportVideo(@Body() dto: ExportVideoDto) {
    const data = await this.exportService.exportVideo(dto.storyId, dto);
    return { data };
  }

  // 잡 상태 조회
  @Get(':jobId/status')
  getJobStatus(@Param('jobId') jobId: string) {
    const data = this.exportService.getJobStatus(jobId);
    return { data };
  }

  // 내보내기 가능한 이야기 목록 (세션 기준)
  @Get('stories')
  @Roles('teacher')
  async getExportableStories(@Query('sessionId') sessionId: string) {
    const data = await this.exportService.getExportableStories(sessionId);
    return { data };
  }
}
