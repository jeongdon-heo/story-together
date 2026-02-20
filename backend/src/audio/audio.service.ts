import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

// TTS 음성 스타일 → Google Cloud TTS 음성 이름 매핑 (ko-KR)
const VOICE_NAME_MAP: Record<string, { name: string; gender: string }> = {
  grandmother: { name: 'ko-KR-Wavenet-B', gender: 'FEMALE' },
  child:       { name: 'ko-KR-Wavenet-D', gender: 'FEMALE' },
  narrator:    { name: 'ko-KR-Wavenet-C', gender: 'FEMALE' },
  actor:       { name: 'ko-KR-Wavenet-A', gender: 'FEMALE' },
};

const SPEED_MAP: Record<string, number> = {
  slow:   0.75,
  normal: 1.0,
  fast:   1.25,
};

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);
  private readonly uploadsDir: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // TTS 생성 (비동기)
  async generateTts(storyId: string, voiceStyle: string, speed: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { parts: { orderBy: { order: 'asc' } } },
    });
    if (!story) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    const jobId = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 비동기 처리
    this.processTts(jobId, storyId, story.parts.map((p) => p.text).join('\n\n'), voiceStyle, speed)
      .catch((err) => this.logger.error('TTS 생성 실패:', err));

    return { jobId, status: 'processing' };
  }

  // 스토리 오디오 트랙 목록
  async getStoryAudio(storyId: string) {
    return this.prisma.audioTrack.findMany({
      where: { storyId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // --- 내부 처리 ---

  private async processTts(
    jobId: string,
    storyId: string,
    text: string,
    voiceStyle: string,
    speed: string,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_TTS_KEY');
    const voice = VOICE_NAME_MAP[voiceStyle] || VOICE_NAME_MAP.narrator;
    const speakingRate = SPEED_MAP[speed] || 1.0;
    let audioUrl: string;

    if (apiKey) {
      // Google Cloud TTS REST API 호출
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: 'ko-KR', name: voice.name, ssmlGender: voice.gender },
            audioConfig: { audioEncoding: 'MP3', speakingRate },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Google TTS API 오류: ${response.status}`);
      }

      const data = (await response.json()) as { audioContent: string };
      const audioBuffer = Buffer.from(data.audioContent, 'base64');
      const filename = `${storyId}-${Date.now()}.mp3`;
      const filePath = path.join(this.uploadsDir, filename);
      fs.writeFileSync(filePath, audioBuffer);
      audioUrl = `/uploads/audio/${filename}`;
    } else {
      // API 키 미설정 시 샘플 URL
      this.logger.warn('GOOGLE_TTS_KEY 미설정 — 샘플 오디오 URL 사용');
      audioUrl = 'https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3';
    }

    await this.prisma.audioTrack.create({
      data: {
        storyId,
        type: 'tts',
        voiceStyle,
        audioUrl,
      },
    });

    this.logger.log(`TTS 완료: storyId=${storyId}, jobId=${jobId}`);
  }
}
