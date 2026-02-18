import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsUUID, IsIn, IsOptional, IsString } from 'class-validator';
import { AudioService } from './audio.service';

const VALID_VOICE_STYLES = ['grandmother', 'child', 'narrator', 'actor'];
const VALID_SPEEDS = ['slow', 'normal', 'fast'];
const VALID_BGM_MODES = [
  'auto', 'peaceful', 'travel', 'adventure', 'tension',
  'scary', 'sad', 'warm', 'magical', 'joy', 'night', 'victory', 'epilogue',
];
const VALID_FORMATS = ['mp3', 'ogg'];

class GenerateTtsDto {
  @IsUUID()
  storyId: string;

  @IsIn(VALID_VOICE_STYLES)
  voiceStyle: string;

  @IsOptional()
  @IsIn(VALID_SPEEDS)
  speed?: string;
}

class GenerateBgmDto {
  @IsUUID()
  storyId: string;

  @IsOptional()
  @IsIn(VALID_BGM_MODES)
  bgmMode?: string;
}

class AnalyzeTimelineDto {
  @IsUUID()
  storyId: string;
}

class CombineAudioDto {
  @IsUUID()
  storyId: string;

  @IsUUID()
  ttsTrackId: string;

  @IsUUID()
  bgmTrackId: string;

  @IsOptional()
  @IsIn(VALID_FORMATS)
  format?: string;
}

@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  // TTS 생성
  @Post('tts')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateTts(@Body() dto: GenerateTtsDto) {
    const result = await this.audioService.generateTts(
      dto.storyId,
      dto.voiceStyle,
      dto.speed || 'normal',
    );
    return { data: result };
  }

  // BGM 생성
  @Post('bgm')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateBgm(@Body() dto: GenerateBgmDto) {
    const result = await this.audioService.generateBgm(
      dto.storyId,
      dto.bgmMode || 'auto',
    );
    return { data: result };
  }

  // 분위기 타임라인 분석
  @Post('analyze-mood-timeline')
  async analyzeMoodTimeline(@Body() dto: AnalyzeTimelineDto) {
    const result = await this.audioService.analyzeMoodTimeline(dto.storyId);
    return { data: result };
  }

  // 오디오 합성
  @Post('combine')
  @HttpCode(HttpStatus.ACCEPTED)
  async combineAudio(@Body() dto: CombineAudioDto) {
    const result = await this.audioService.combineAudio(
      dto.storyId,
      dto.ttsTrackId,
      dto.bgmTrackId,
      dto.format || 'mp3',
    );
    return { data: result };
  }

  // 스토리 오디오 목록
  @Get('story/:storyId')
  async getStoryAudio(@Param('storyId') storyId: string) {
    const tracks = await this.audioService.getStoryAudio(storyId);
    return { data: { tracks } };
  }
}
