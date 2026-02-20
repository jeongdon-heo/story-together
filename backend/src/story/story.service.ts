import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { StickerService } from '../sticker/sticker.service';
import { CreateStoryDto } from './dto/create-story.dto';

@Injectable()
export class StoryService {
  private readonly logger = new Logger(StoryService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private stickerService: StickerService,
  ) {}

  // 이야기 생성 + 첫 파트 자동 생성
  // - solo 모드: AI가 이야기 시작 생성
  // - same_start 모드: 세션 themeData.introText를 공통 도입부로 사용
  async create(userId: string, dto: CreateStoryDto) {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: dto.sessionId },
      include: { classRoom: { select: { grade: true } } },
    });

    const aiCharacter = dto.aiCharacter || 'grandmother';
    const grade = session.classRoom?.grade || 3;
    const themeData = session.themeData as any;
    const isSameStart = session.mode === 'same_start';

    // 이야기 생성
    const story = await this.prisma.story.create({
      data: {
        sessionId: dto.sessionId,
        userId,
        aiCharacter,
        status: 'writing',
        sharedIntro: isSameStart ? themeData.introText : null,
      },
    });

    let firstPartText: string;
    let firstPartMeta: Record<string, any>;

    if (isSameStart && themeData.introText) {
      // 같은 시작: 공통 도입부를 첫 파트로 사용
      firstPartText = themeData.introText;
      firstPartMeta = { mood: 'peaceful', isIntro: true };
    } else {
      // solo/relay: AI가 이야기 시작 생성
      firstPartText = await this.aiService.generateStoryStart(
        { label: themeData.label, desc: themeData.desc },
        grade,
        aiCharacter,
      );
      firstPartMeta = { mood: 'peaceful' };
    }

    const firstPart = await this.prisma.storyPart.create({
      data: {
        storyId: story.id,
        authorType: 'ai',
        text: firstPartText,
        order: 1,
        metadata: firstPartMeta,
      },
    });

    return {
      ...story,
      parts: [firstPart],
    };
  }

  // 이야기 목록
  async findMany(filters: {
    sessionId?: string;
    userId?: string;
    status?: string;
  }) {
    return this.prisma.story.findMany({
      where: {
        ...(filters.sessionId && { sessionId: filters.sessionId }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.status && { status: filters.status }),
      },
      include: {
        parts: { orderBy: { order: 'asc' } },
        _count: { select: { parts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 이야기 상세 (파트 포함)
  async findById(id: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: {
          include: { classRoom: { select: { grade: true } } },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('이야기를 찾을 수 없습니다');
    }

    const totalTurns = story.parts.length;
    const wordCount = story.parts.reduce(
      (sum, p) => sum + p.text.length,
      0,
    );

    return {
      ...story,
      metadata: { totalTurns, wordCount },
    };
  }

  // 학생 파트 추가 + AI 응답 자동 생성
  async addPart(storyId: string, userId: string, text: string) {
    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: {
          include: { classRoom: { select: { grade: true } } },
        },
      },
    });

    if (story.status !== 'writing') {
      throw new ForbiddenException('이미 완료된 이야기입니다');
    }

    const nextOrder = story.parts.length + 1;
    const grade = story.session?.classRoom?.grade || 3;

    // 콘텐츠 검수
    const check = await this.aiService.checkContent(text, grade);
    if (!check.safe) {
      return {
        studentPart: null,
        aiPart: null,
        rejected: true,
        reason: check.reason,
        suggestion: check.suggestion,
      };
    }

    // 학생 파트 저장
    const studentPart = await this.prisma.storyPart.create({
      data: {
        storyId,
        authorId: userId,
        authorType: 'student',
        text,
        order: nextOrder,
      },
    });

    // AI 이어쓰기
    const previousParts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as
        | 'user'
        | 'assistant',
      content: p.text,
    }));
    previousParts.push({ role: 'user', content: text });

    try {
      this.logger.log(`addPart: AI 이어쓰기 호출 시작 — parts=${previousParts.length}, grade=${grade}`);
      const aiText = await this.aiService.continueStory(
        previousParts,
        grade,
        story.aiCharacter || 'grandmother',
      );
      this.logger.log(`addPart: AI 이어쓰기 성공 — ${aiText.length}자`);

      const aiPart = await this.prisma.storyPart.create({
        data: {
          storyId,
          authorType: 'ai',
          text: aiText,
          order: nextOrder + 1,
          metadata: { mood: 'adventure' },
        },
      });

      return { studentPart, aiPart };
    } catch (error: any) {
      this.logger.error(`addPart: AI 이어쓰기 실패 — ${error.message}`, error.stack);
      return { studentPart, aiPart: null, aiError: error.message };
    }
  }

  // 이야기 완료 (결말 생성)
  async complete(storyId: string, userId: string) {
    this.logger.log(`complete 호출: storyId=${storyId}, userId=${userId}`);

    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: {
          include: { classRoom: { select: { grade: true } } },
        },
      },
    });

    if (story.status !== 'writing') {
      throw new ForbiddenException('이미 완료된 이야기입니다');
    }

    const grade = story.session?.classRoom?.grade || 3;
    const previousParts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as
        | 'user'
        | 'assistant',
      content: p.text,
    }));

    this.logger.log(`complete: grade=${grade}, parts=${previousParts.length}, totalChars=${previousParts.reduce((s, p) => s + p.content.length, 0)}`);

    let endingText: string;
    try {
      endingText = await this.aiService.generateEnding(
        previousParts,
        grade,
        story.aiCharacter || 'grandmother',
      );
    } catch (error: any) {
      this.logger.error(`complete: generateEnding 실패 — ${error.message}`, error.stack);
      throw new Error(`마무리 생성에 실패했습니다. 다시 시도해주세요.`);
    }

    if (!endingText || !endingText.trim()) {
      this.logger.error('complete: 결말 텍스트가 비어있음');
      throw new Error('마무리 생성에 실패했습니다. 다시 시도해주세요.');
    }

    this.logger.log(`complete: 결말 생성 완료 (${endingText.length}자)`);

    const nextOrder = story.parts.length + 1;

    const endingPart = await this.prisma.storyPart.create({
      data: {
        storyId,
        authorType: 'ai',
        text: endingText,
        order: nextOrder,
        metadata: { mood: 'joy', isEnding: true },
      },
    });

    const updatedStory = await this.prisma.story.update({
      where: { id: storyId },
      data: { status: 'completed', completedAt: new Date() },
    });

    // 활동 스티커 자동 부여 (비동기, 실패해도 무시)
    if (story.userId) {
      this.stickerService.checkAndAutoAward(story.userId, storyId).catch(() => {});
    }

    return { endingPart, story: updatedStory };
  }

  // 파트 수정 (교사)
  async updatePart(partId: string, text: string) {
    return this.prisma.storyPart.update({
      where: { id: partId },
      data: { text },
    });
  }

  // 파트 삭제 (교사)
  async deletePart(partId: string) {
    await this.prisma.storyPart.delete({ where: { id: partId } });
    return { message: '파트가 삭제되었습니다' };
  }

  // 내 이야기 목록 (세션 모드 포함, 경량 DTO)
  async findMyStories(
    userId: string,
    filters: { mode?: string; status?: string; sort?: string },
  ) {
    const stories = await this.prisma.story.findMany({
      where: {
        userId,
        ...(filters.status && { status: filters.status }),
        ...(filters.mode && {
          session: { mode: filters.mode },
        }),
      },
      include: {
        session: { select: { mode: true, title: true } },
        parts: { select: { text: true }, orderBy: { order: 'asc' } },
      },
      orderBy: {
        createdAt: filters.sort === 'oldest' ? 'asc' : 'desc',
      },
    });

    return stories.map((s) => ({
      id: s.id,
      sessionId: s.sessionId,
      mode: s.session?.mode || 'solo',
      status: s.status,
      title: s.session?.title || '',
      aiCharacter: s.aiCharacter,
      partCount: s.parts.length,
      wordCount: s.parts.reduce((sum, p) => sum + p.text.length, 0),
      completedAt: s.completedAt,
      createdAt: s.createdAt,
    }));
  }

  // 부적절 내용 플래그
  async flagPart(partId: string) {
    return this.prisma.storyPart.update({
      where: { id: partId },
      data: { flagged: true },
    });
  }
}
