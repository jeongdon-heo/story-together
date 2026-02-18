import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

// 분위기별 BGM URL (무료 음원 / Mubert API 대체)
// 실제 서비스에서는 MUBERT_API_KEY로 생성된 URL로 교체
const MOOD_BGM_MAP: Record<string, string> = {
  peaceful:   'https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3',
  travel:     'https://cdn.pixabay.com/audio/2022/03/24/audio_1a609d0dca.mp3',
  adventure:  'https://cdn.pixabay.com/audio/2022/10/30/audio_a99d53d6c5.mp3',
  tension:    'https://cdn.pixabay.com/audio/2022/09/13/audio_f9b5b62a7c.mp3',
  scary:      'https://cdn.pixabay.com/audio/2022/11/17/audio_3ca9f5d0f8.mp3',
  sad:        'https://cdn.pixabay.com/audio/2022/01/20/audio_5cded56f7a.mp3',
  warm:       'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
  magical:    'https://cdn.pixabay.com/audio/2021/11/25/audio_04b5c0ce5f.mp3',
  joy:        'https://cdn.pixabay.com/audio/2022/08/23/audio_004a8f07c6.mp3',
  night:      'https://cdn.pixabay.com/audio/2022/03/10/audio_b0e5e2f83e.mp3',
  victory:    'https://cdn.pixabay.com/audio/2022/10/07/audio_a7ca278c7a.mp3',
  epilogue:   'https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3',
};

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
    private aiService: AiService,
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

  // BGM 생성 (비동기)
  async generateBgm(storyId: string, bgmMode: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { parts: { orderBy: { order: 'asc' }, take: 5 } },
    });
    if (!story) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    const jobId = `bgm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    this.processBgm(jobId, storyId, story.parts.map((p) => p.text).join('\n\n'), bgmMode)
      .catch((err) => this.logger.error('BGM 생성 실패:', err));

    return { jobId, status: 'processing' };
  }

  // 분위기 타임라인 분석
  async analyzeMoodTimeline(storyId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { parts: { orderBy: { order: 'asc' } } },
    });
    if (!story) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    // 각 파트별 분위기 분석 (병렬)
    const moodResults = await Promise.all(
      story.parts.map((part) =>
        this.aiService.analyzeMood(part.text).catch(() => ({
          mood: 'peaceful',
          intensity: 0.5,
          suggestedBgm: 'gentle',
        })),
      ),
    );

    // 추정 읽기 시간: 한국어 평균 400자/분
    let startSec = 0;
    const timeline = story.parts.map((part, i) => {
      const duration = Math.max(5, Math.round((part.text.length / 400) * 60));
      const entry = {
        partId: part.id,
        partOrder: part.order,
        authorType: part.authorType,
        startSec,
        endSec: startSec + duration,
        mood: moodResults[i].mood,
        intensity: moodResults[i].intensity,
        bgmStyle: moodResults[i].suggestedBgm,
      };
      startSec += duration;
      return entry;
    });

    return { timeline, totalSec: startSec };
  }

  // 오디오 합성 (TTS + BGM)
  async combineAudio(storyId: string, ttsTrackId: string, bgmTrackId: string, format: string) {
    const [ttsTrack, bgmTrack] = await Promise.all([
      this.prisma.audioTrack.findUnique({ where: { id: ttsTrackId } }),
      this.prisma.audioTrack.findUnique({ where: { id: bgmTrackId } }),
    ]);
    if (!ttsTrack || !bgmTrack) {
      throw new NotFoundException('오디오 트랙을 찾을 수 없습니다.');
    }

    const jobId = `combine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 실제 서비스에서는 ffmpeg로 TTS + BGM 믹싱
    // 현재는 combined 트랙 레코드만 생성
    this.processCombine(jobId, storyId, ttsTrack.audioUrl, bgmTrack.audioUrl, format)
      .catch((err) => this.logger.error('합성 실패:', err));

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

  private async processBgm(
    jobId: string,
    storyId: string,
    storyText: string,
    bgmMode: string,
  ) {
    let audioUrl: string;
    let moodTimeline: any = null;

    if (bgmMode === 'auto') {
      // 이야기 전체 분위기 분석
      const mood = await this.aiService.analyzeMood(storyText);
      audioUrl = MOOD_BGM_MAP[mood.mood] || MOOD_BGM_MAP.peaceful;

      // Mubert API 키가 있으면 실제 BGM 생성
      const mubertKey = this.configService.get<string>('MUBERT_API_KEY');
      if (mubertKey) {
        // Mubert API 호출 구조 (실제 엔드포인트는 Mubert 파트너 계정 필요)
        this.logger.log(`Mubert API로 BGM 생성 시도: mood=${mood.mood}`);
        // audioUrl = await this.callMubertApi(mubertKey, mood.mood, 180);
      }
    } else {
      // 수동 분위기 지정
      audioUrl = MOOD_BGM_MAP[bgmMode] || MOOD_BGM_MAP.peaceful;
    }

    await this.prisma.audioTrack.create({
      data: {
        storyId,
        type: 'bgm',
        bgmMode,
        audioUrl,
        moodTimeline,
      },
    });

    this.logger.log(`BGM 완료: storyId=${storyId}, jobId=${jobId}`);
  }

  private async processCombine(
    jobId: string,
    storyId: string,
    ttsUrl: string,
    bgmUrl: string,
    format: string,
  ) {
    // 실제 구현 시: ffmpeg -i tts.mp3 -i bgm.mp3 -filter_complex amix=inputs=2:duration=first:weights="1 0.3" output.mp3
    // 현재는 TTS URL을 combined로 간주 (BGM 정보는 메타데이터에 포함)
    const combinedUrl = ttsUrl;

    await this.prisma.audioTrack.create({
      data: {
        storyId,
        type: 'combined',
        audioUrl: combinedUrl,
        moodTimeline: { ttsUrl, bgmUrl, format },
      },
    });

    this.logger.log(`합성 완료: storyId=${storyId}, jobId=${jobId}`);
  }
}
