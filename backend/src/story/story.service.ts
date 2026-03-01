import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
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
  // - solo 모드: AI가 이야기 시작 생성 (학생별 개별)
  // - same_start 개인 모드: 세션 themeData.introText를 공통 도입부로 사용 (학생별 개별)
  // - same_start 모둠 모드: 모둠별 공유 이야기 (릴레이 방식)
  // - relay/branch 모드: 세션당 하나의 공유 이야기 (이미 있으면 기존 반환)
  async create(userId: string, dto: CreateStoryDto) {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: dto.sessionId },
      include: { classRoom: { select: { grade: true } } },
    });

    const isSharedMode = session.mode === 'relay' || session.mode === 'branch';
    const settings = session.settings as any;
    const isSameStartGroup =
      session.mode === 'same_start' && settings?.participationType === 'group';

    // relay/branch: 이미 이야기가 있으면 기존 이야기 반환 (중복 생성 방지)
    if (isSharedMode) {
      const existing = await this.prisma.story.findFirst({
        where: { sessionId: dto.sessionId },
        include: { parts: { orderBy: { order: 'asc' } } },
      });
      if (existing) {
        return existing;
      }
    }

    // same_start 모둠 모드: 모둠별 공유 이야기 (이미 있으면 반환)
    if (isSameStartGroup) {
      const groups = settings.groups || {};
      let userGroupNumber: string | null = null;
      for (const [key, group] of Object.entries(groups)) {
        if ((group as any).memberIds?.includes(userId)) {
          userGroupNumber = key;
          break;
        }
      }
      if (!userGroupNumber) {
        throw new ForbiddenException('모둠에 참여해야 이야기를 시작할 수 있습니다');
      }

      // 이 모둠의 이야기가 이미 있으면 반환
      const sessionStories = await this.prisma.story.findMany({
        where: { sessionId: dto.sessionId },
        include: { parts: { orderBy: { order: 'asc' } } },
      });
      const existingGroupStory = sessionStories.find(
        (s) => (s.metadata as any)?.groupNumber === parseInt(userGroupNumber!),
      );
      if (existingGroupStory) {
        return existingGroupStory;
      }

      // 모둠 공유 이야기 생성
      const aiCharacter = dto.aiCharacter || 'grandmother';
      const themeData = session.themeData as any;
      const story = await this.prisma.story.create({
        data: {
          sessionId: dto.sessionId,
          userId: null,
          aiCharacter,
          status: 'writing',
          sharedIntro: themeData.introText || null,
          metadata: { groupNumber: parseInt(userGroupNumber) },
        },
      });

      const firstPart = await this.prisma.storyPart.create({
        data: {
          storyId: story.id,
          authorType: 'ai',
          text: themeData.introText || '옛날 옛날에...',
          order: 1,
          metadata: { mood: 'peaceful', isIntro: true },
        },
      });

      return { ...story, parts: [firstPart] };
    }

    const aiCharacter = dto.aiCharacter || 'grandmother';
    const grade = session.classRoom?.grade || 3;
    const themeData = session.themeData as any;
    const isSameStart = session.mode === 'same_start';

    // 이야기 생성 (relay/branch는 userId를 null로 → 공유 이야기)
    const story = await this.prisma.story.create({
      data: {
        sessionId: dto.sessionId,
        userId: isSharedMode ? null : userId,
        aiCharacter,
        status: 'writing',
        sharedIntro: isSameStart ? themeData.introText : null,
      },
    });

    let firstPartText: string;
    let firstPartMeta: Record<string, any>;

    if (isSameStart && themeData.introText) {
      // 같은 시작 (개인): 공통 도입부를 첫 파트로 사용
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

    // solo/same_start 모드 소유권 검증
    if (story.userId && story.userId !== userId) {
      throw new ForbiddenException('이 이야기에 쓸 권한이 없습니다');
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

    // 이미 완료된 이야기면 기존 데이터 반환 (멱등성 보장)
    if (story.status !== 'writing') {
      this.logger.log(`complete: 이미 완료된 이야기 — storyId=${storyId}`);
      const lastPart = story.parts[story.parts.length - 1];
      return { endingPart: lastPart, story };
    }

    // 소유권 검증: 본인 이야기이거나 교사만 완료 가능
    if (story.userId && story.userId !== userId) {
      throw new ForbiddenException('이 이야기를 완료할 권한이 없습니다');
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
      // NestJS 예외는 그대로 전달 (HttpException 계열)
      if (error?.getStatus) throw error;
      throw new InternalServerErrorException('마무리 생성에 실패했습니다. 다시 시도해주세요.');
    }

    if (!endingText || !endingText.trim()) {
      this.logger.error('complete: 결말 텍스트가 비어있음');
      throw new InternalServerErrorException('마무리 생성에 실패했습니다. 다시 시도해주세요.');
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

    // solo 모드: 이야기 완료 시 세션도 자동 완료
    if (story.session?.mode === 'solo') {
      await this.prisma.session.update({
        where: { id: story.sessionId },
        data: { status: 'completed', completedAt: new Date() },
      }).catch(() => {});
    }

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
