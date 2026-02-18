import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

export const STYLE_SUFFIXES: Record<string, string> = {
  crayon:
    ", children's crayon drawing style, warm colorful, rough texture, childlike, simple shapes",
  watercolor:
    ', soft watercolor painting, dreamy pastel colors, gentle brushstrokes, fairy tale illustration',
  sketch:
    ', pencil sketch, black and white, delicate line art, hand drawn, storybook illustration',
  classic:
    ', classic fairy tale book illustration, detailed, golden age illustration style, rich colors',
  cartoon:
    ', cute cartoon style, bright vibrant colors, kawaii, rounded shapes, cheerful',
  fantasy:
    ', epic fantasy art, dramatic lighting, magical atmosphere, detailed digital painting',
};

@Injectable()
export class IllustrationService {
  private openai: OpenAI;
  private readonly logger = new Logger(IllustrationService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY') || '',
    });
  }

  // 이야기 장면 분석
  async analyzeScenes(storyId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { parts: { orderBy: { order: 'asc' } } },
    });
    if (!story) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    // 이야기 전체 텍스트 구성 (파트 order 포함)
    const storyText = story.parts
      .map((p) => `[Part ${p.order}] ${p.text}`)
      .join('\n\n');

    const scenes = await this.aiService.analyzeScenes(storyText);
    return scenes;
  }

  // 삽화 생성 (비동기 처리)
  async generateIllustration(
    storyId: string,
    sceneIndex: number,
    sceneText: string,
    style: string,
    branchNodeId?: string,
  ) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 비동기로 실제 이미지 생성 (응답은 즉시 반환)
    this.processIllustration(jobId, storyId, sceneIndex, sceneText, style, false, branchNodeId).catch(
      (err) => this.logger.error('삽화 생성 실패:', err),
    );

    return { jobId, status: 'processing' };
  }

  // 표지 삽화 생성
  async generateCover(storyId: string, style: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { parts: { orderBy: { order: 'asc' }, take: 3 } },
    });
    if (!story) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    const introText = story.parts.map((p) => p.text).join(' ');
    const sceneText = introText.slice(0, 200);

    const jobId = `job-cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.processIllustration(jobId, storyId, -1, sceneText, style, true).catch(
      (err) => this.logger.error('표지 생성 실패:', err),
    );

    return { jobId, status: 'processing' };
  }

  // 이야기의 삽화 목록 조회
  async getStoryIllustrations(storyId: string) {
    return this.prisma.illustration.findMany({
      where: { storyId },
      orderBy: [{ isCover: 'desc' }, { sceneIndex: 'asc' }],
    });
  }

  // 삽화 삭제
  async deleteIllustration(id: string, userId: string) {
    const illust = await this.prisma.illustration.findUnique({
      where: { id },
      include: { story: { select: { userId: true } } },
    });
    if (!illust) throw new NotFoundException('삽화를 찾을 수 없습니다.');
    if (illust.story.userId !== userId) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }
    await this.prisma.illustration.delete({ where: { id } });
    return { success: true };
  }

  // 삽화 재생성
  async regenerateIllustration(id: string, userId: string) {
    const illust = await this.prisma.illustration.findUnique({
      where: { id },
      include: { story: { select: { userId: true } } },
    });
    if (!illust) throw new NotFoundException('삽화를 찾을 수 없습니다.');
    if (illust.story.userId !== userId) {
      throw new ForbiddenException('재생성 권한이 없습니다.');
    }

    const jobId = `job-regen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 기존 삽화 삭제 후 재생성
    await this.prisma.illustration.delete({ where: { id } });
    this.processIllustration(
      jobId,
      illust.storyId,
      illust.sceneIndex,
      illust.sceneText || '',
      illust.style,
      illust.isCover,
    ).catch((err) => this.logger.error('재생성 실패:', err));

    return { jobId, status: 'processing' };
  }

  // --- 실제 이미지 생성 처리 ---
  private async processIllustration(
    jobId: string,
    storyId: string,
    sceneIndex: number,
    sceneText: string,
    style: string,
    isCover: boolean,
    branchNodeId?: string,
  ) {
    try {
      // 1. 장면 → 영문 이미지 프롬프트 생성 (Claude)
      const basePrompt = await this.aiService.generateImagePrompt({
        text: sceneText,
        characters: [],
        setting: '',
        mood: isCover ? 'warm, magical' : 'cheerful',
      });

      // 2. 스타일 접미사 추가
      const styleSuffix = STYLE_SUFFIXES[style] || STYLE_SUFFIXES.watercolor;
      const finalPrompt = basePrompt + styleSuffix;

      this.logger.log(`이미지 프롬프트: ${finalPrompt}`);

      // 3. DALL-E 3 이미지 생성
      const imageResponse = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });

      const imageUrl = (imageResponse.data as Array<{ url?: string }>)[0]?.url || '';

      // 4. DB 저장
      await this.prisma.illustration.create({
        data: {
          storyId,
          sceneIndex,
          sceneText,
          style,
          prompt: finalPrompt,
          imageUrl,
          isCover,
          branchNodeId: branchNodeId || null,
        },
      });

      this.logger.log(`삽화 생성 완료: storyId=${storyId}, jobId=${jobId}`);
    } catch (error) {
      this.logger.error(`삽화 생성 실패 jobId=${jobId}:`, error);
      throw error;
    }
  }
}
