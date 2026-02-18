import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ─── 내장 스티커 정의 ─────────────────────────────────────────
const BUILT_IN_STICKERS = [
  // 활동 (자동 획득)
  { code: 'first_story',       name: '첫 이야기',      emoji: '✏️',  description: '처음으로 이야기를 완성했어요!',          category: 'activity', tier: 'normal',   sortOrder: 1,  condition: { type: 'story_count',  threshold: 1 } },
  { code: 'storyteller_3',     name: '이야기꾼',        emoji: '📖',  description: '이야기 3편을 완성했어요!',               category: 'activity', tier: 'normal',   sortOrder: 2,  condition: { type: 'story_count',  threshold: 3 } },
  { code: 'storyteller_5',     name: '이야기 달인',     emoji: '🏆',  description: '이야기 5편을 완성한 진짜 달인!',          category: 'activity', tier: 'sparkle',  sortOrder: 3,  condition: { type: 'story_count',  threshold: 5 } },
  { code: 'storyteller_10',    name: '이야기 마스터',   emoji: '👑',  description: '무려 10편! 이야기의 왕!',               category: 'activity', tier: 'hologram', sortOrder: 4,  condition: { type: 'story_count',  threshold: 10 } },
  { code: 'relay_first',       name: '릴레이 데뷔',     emoji: '🔗',  description: '처음으로 릴레이에 참여했어요!',           category: 'relay',    tier: 'normal',   sortOrder: 10, condition: { type: 'relay_count',  threshold: 1 } },
  { code: 'relay_master',      name: '릴레이 챔피언',   emoji: '🏅',  description: '릴레이 3회 이상 참여한 팀플레이어!',      category: 'relay',    tier: 'sparkle',  sortOrder: 11, condition: { type: 'relay_count',  threshold: 3 } },
  { code: 'branch_voter',      name: '선택의 달인',     emoji: '🌿',  description: '갈래 이야기에서 투표에 참여했어요!',      category: 'branch',   tier: 'normal',   sortOrder: 20, condition: { type: 'branch_count', threshold: 1 } },
  { code: 'word_100',          name: '100자 달성',      emoji: '💯',  description: '이야기에서 100자를 썼어요!',             category: 'writing',  tier: 'normal',   sortOrder: 30, condition: { type: 'word_count',   threshold: 100 } },
  { code: 'word_500',          name: '500자 달성',      emoji: '🌟',  description: '무려 500자! 글쓰기 실력이 쑥쑥!',        category: 'writing',  tier: 'sparkle',  sortOrder: 31, condition: { type: 'word_count',   threshold: 500 } },
  { code: 'word_1000',         name: '1000자 달성',     emoji: '🚀',  description: '1000자 돌파! 글쓰기 영웅!',             category: 'writing',  tier: 'hologram', sortOrder: 32, condition: { type: 'word_count',   threshold: 1000 } },
  // 교사 수여 전용 (자동 획득 없음)
  { code: 'teacher_creativity',name: '창의력 대장',     emoji: '💫',  description: '독창적인 아이디어나 전개를 보인 학생에게',category: 'teacher',  tier: 'legendary', sortOrder: 50, condition: null },
  { code: 'teacher_teamwork',  name: '협동 왕',          emoji: '🤝',  description: '친구들과 완벽한 협동을 보여준 학생에게', category: 'teacher',  tier: 'legendary', sortOrder: 51, condition: null },
  { code: 'teacher_effort',    name: '노력 상',          emoji: '💪',  description: '꾸준한 노력이 빛나는 학생에게',          category: 'teacher',  tier: 'legendary', sortOrder: 52, condition: null },
  { code: 'teacher_kindness',  name: '따뜻한 마음',      emoji: '💖',  description: '따뜻하고 배려 넘치는 이야기를 쓴 학생에게', category: 'teacher', tier: 'legendary', sortOrder: 53, condition: null },
  { code: 'teacher_humor',     name: '유머 천재',        emoji: '😂',  description: '이야기에서 웃음을 선사한 학생에게',      category: 'teacher',  tier: 'legendary', sortOrder: 54, condition: null },
];

const TIER_ORDER: Record<string, number> = { normal: 0, sparkle: 1, hologram: 2, legendary: 3 };

@Injectable()
export class StickerService implements OnModuleInit {
  private readonly logger = new Logger(StickerService.name);

  constructor(private prisma: PrismaService) {}

  // 모듈 초기화 시 내장 스티커 시드
  async onModuleInit() {
    try {
      for (const def of BUILT_IN_STICKERS) {
        await this.prisma.stickerDef.upsert({
          where: { code: def.code },
          update: {},
          create: {
            ...def,
            isBuiltIn: true,
            condition: def.condition !== null ? (def.condition as Prisma.InputJsonValue) : Prisma.DbNull,
          },
        });
      }
      this.logger.log(`스티커 시드 완료: ${BUILT_IN_STICKERS.length}개`);
    } catch (err) {
      this.logger.warn('스티커 시드 실패 (DB 미연결?):', err);
    }
  }

  // ─── 스티커 도감 정의 목록 ────────────────────────────────
  async getDefinitions() {
    const defs = await this.prisma.stickerDef.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return { stickers: defs };
  }

  // ─── 내 스티커 목록 + 도감 진행률 ─────────────────────────
  async getMyStickers(userId: string) {
    const [earned, allDefs, featured] = await Promise.all([
      this.prisma.userSticker.findMany({
        where: { userId },
        include: {
          stickerDef: true,
          customStickerDef: true,
          awarder: { select: { name: true } },
        },
        orderBy: { earnedAt: 'desc' },
      }),
      this.prisma.stickerDef.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.featuredSticker.findMany({
        where: { userId },
        include: { sticker: { include: { stickerDef: true, customStickerDef: true } } },
        orderBy: { position: 'asc' },
      }),
    ]);

    const earnedList = earned.map((us) => ({
      id: us.id,
      stickerCode: us.stickerDef?.code || `custom:${us.customStickerDef?.id}`,
      name: us.stickerDef?.name || us.customStickerDef?.name || '',
      emoji: us.stickerDef?.emoji || us.customStickerDef?.emoji || '🌟',
      tier: us.stickerDef?.tier || us.customStickerDef?.tier || 'normal',
      category: us.stickerDef?.category || 'teacher',
      isNew: us.isNew,
      earnedAt: us.earnedAt,
      relatedStoryId: us.relatedStoryId,
      awardedBy: us.awarder?.name || null,
      awardComment: us.awardComment,
    }));

    // 요약
    const summary = {
      total: earnedList.length,
      normal: earnedList.filter((s) => s.tier === 'normal').length,
      sparkle: earnedList.filter((s) => s.tier === 'sparkle').length,
      hologram: earnedList.filter((s) => s.tier === 'hologram').length,
      legendary: earnedList.filter((s) => s.tier === 'legendary').length,
      newCount: earnedList.filter((s) => s.isNew).length,
    };

    // 대표 스티커
    const featuredList = featured.map((f) => ({
      position: f.position,
      stickerId: f.stickerId,
      emoji: f.sticker.stickerDef?.emoji || f.sticker.customStickerDef?.emoji || '🌟',
      name: f.sticker.stickerDef?.name || f.sticker.customStickerDef?.name || '',
    }));

    // 도감 진행률 (조건 있는 스티커들)
    const earnedCodes = new Set(earnedList.map((s) => s.stickerCode));
    const conditionDefs = allDefs.filter((d) => d.condition && !earnedCodes.has(d.code));

    // 현재 학생의 활동 데이터
    const storyCount = await this.prisma.story.count({ where: { userId, status: 'completed' } });

    // 글자 수는 metadata JSON에서 꺼내야 함
    const stories = await this.prisma.story.findMany({
      where: { userId, status: 'completed' },
      select: { metadata: true },
    });
    const wordTotal = stories.reduce(
      (sum, s) => sum + ((s.metadata as any)?.wordCount || 0),
      0,
    );

    const progress = conditionDefs
      .filter((d) => (d.condition as any)?.type)
      .map((d) => {
        const cond = d.condition as { type: string; threshold: number };
        let current = 0;
        if (cond.type === 'story_count') current = storyCount;
        else if (cond.type === 'word_count') current = wordTotal;
        return {
          code: d.code,
          name: d.name,
          emoji: d.emoji,
          tier: d.tier,
          current: Math.min(current, cond.threshold),
          threshold: cond.threshold,
          percent: Math.round((Math.min(current, cond.threshold) / cond.threshold) * 100),
        };
      })
      .filter((p) => p.percent > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5);

    return { earned: earnedList, summary, featured: featuredList, progress };
  }

  // ─── 특정 학생 스티커 조회 (교사용) ──────────────────────
  async getUserStickers(userId: string) {
    const result = await this.getMyStickers(userId);
    return result;
  }

  // ─── 새 스티커 확인 처리 ────────────────────────────────
  async readSticker(userId: string, stickerId: string) {
    const us = await this.prisma.userSticker.findFirst({
      where: { id: stickerId, userId },
    });
    if (!us) throw new NotFoundException('스티커를 찾을 수 없습니다.');

    await this.prisma.userSticker.update({
      where: { id: stickerId },
      data: { isNew: false },
    });
    return { stickerId, isNew: false };
  }

  // ─── 대표 스티커 설정 ────────────────────────────────────
  async setFeatured(userId: string, featured: Array<{ position: number; stickerId: string }>) {
    // 기존 대표 삭제 후 재설정
    await this.prisma.featuredSticker.deleteMany({ where: { userId } });

    const created = await Promise.all(
      featured.map((f) =>
        this.prisma.featuredSticker.create({
          data: { userId, stickerId: f.stickerId, position: f.position },
        }),
      ),
    );
    return { featured: created };
  }

  // ─── 교사 수여 ───────────────────────────────────────────
  async awardSticker(
    teacherId: string,
    studentId: string,
    stickerCode: string,
    comment?: string,
    relatedStoryId?: string,
  ) {
    const def = await this.prisma.stickerDef.findUnique({ where: { code: stickerCode } });
    if (!def) throw new NotFoundException(`스티커 코드 '${stickerCode}'를 찾을 수 없습니다.`);

    // 이미 가지고 있으면 중복 수여 방지
    const existing = await this.prisma.userSticker.findUnique({
      where: { userId_stickerDefId: { userId: studentId, stickerDefId: def.id } },
    });
    if (existing) {
      return {
        id: existing.id, studentId, stickerCode,
        name: def.name, emoji: def.emoji, tier: def.tier,
        awardComment: existing.awardComment, earnedAt: existing.earnedAt,
        alreadyHad: true,
      };
    }

    const us = await this.prisma.userSticker.create({
      data: {
        userId: studentId,
        stickerDefId: def.id,
        awardedBy: teacherId,
        awardComment: comment,
        relatedStoryId: relatedStoryId || null,
        isNew: true,
      },
    });

    return {
      id: us.id, studentId, stickerCode,
      name: def.name, emoji: def.emoji, tier: def.tier,
      awardComment: comment, earnedAt: us.earnedAt,
    };
  }

  // ─── 일괄 수여 ───────────────────────────────────────────
  async awardBulk(
    teacherId: string,
    studentIds: string[],
    stickerCode: string,
    comment?: string,
    relatedSessionId?: string,
  ) {
    const results = await Promise.all(
      studentIds.map((sid) =>
        this.awardSticker(teacherId, sid, stickerCode, comment).catch(() => null),
      ),
    );
    const awarded = results.filter(Boolean).length;
    return { awarded, results: results.filter(Boolean) };
  }

  // ─── 커스텀 스티커 생성 ──────────────────────────────────
  async createCustom(teacherId: string, name: string, emoji: string, description?: string) {
    return this.prisma.customStickerDef.create({
      data: { teacherId, name, emoji, description: description || '', tier: 'legendary' },
    });
  }

  // ─── 내 커스텀 스티커 목록 ───────────────────────────────
  async getMyCustom(teacherId: string) {
    return this.prisma.customStickerDef.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── 커스텀 스티커 삭제 ──────────────────────────────────
  async deleteCustom(id: string, teacherId: string) {
    const def = await this.prisma.customStickerDef.findUnique({ where: { id } });
    if (!def) throw new NotFoundException('커스텀 스티커를 찾을 수 없습니다.');
    if (def.teacherId !== teacherId) throw new ForbiddenException('삭제 권한이 없습니다.');
    await this.prisma.customStickerDef.delete({ where: { id } });
    return { success: true };
  }

  // ─── 커스텀 스티커 수여 ──────────────────────────────────
  async awardCustomSticker(
    teacherId: string,
    customStickerId: string,
    studentId: string,
    comment?: string,
    relatedStoryId?: string,
  ) {
    const def = await this.prisma.customStickerDef.findUnique({
      where: { id: customStickerId },
    });
    if (!def) throw new NotFoundException('커스텀 스티커를 찾을 수 없습니다.');
    if (def.teacherId !== teacherId) throw new ForbiddenException('수여 권한이 없습니다.');

    const us = await this.prisma.userSticker.create({
      data: {
        userId: studentId,
        customStickerId,
        awardedBy: teacherId,
        awardComment: comment,
        relatedStoryId: relatedStoryId || null,
        isNew: true,
      },
    });

    return {
      id: us.id, studentId,
      name: def.name, emoji: def.emoji, tier: def.tier,
      awardComment: comment, earnedAt: us.earnedAt,
    };
  }

  // ─── 활동 자동 스티커 부여 ──────────────────────────────
  async checkAndAutoAward(userId: string, storyId: string) {
    try {
      // 완성된 이야기 수 집계
      const [completedCount, stories] = await Promise.all([
        this.prisma.story.count({ where: { userId, status: 'completed' } }),
        this.prisma.story.findMany({
          where: { userId, status: 'completed' },
          select: { metadata: true },
        }),
      ]);
      const totalWords = stories.reduce(
        (sum, s) => sum + ((s.metadata as any)?.wordCount || 0), 0,
      );

      // 조건부 스티커 정의 전체 조회
      const condDefs = await this.prisma.stickerDef.findMany({
        where: { isBuiltIn: true },
      });

      // 이미 획득한 스티커 코드 집합
      const alreadyEarned = await this.prisma.userSticker.findMany({
        where: { userId },
        select: { stickerDefId: true },
      });
      const earnedDefIds = new Set(alreadyEarned.map((us) => us.stickerDefId));

      const newlyEarned: string[] = [];

      for (const def of condDefs) {
        if (!def.condition || earnedDefIds.has(def.id)) continue;

        const cond = def.condition as { type: string; threshold: number };
        let met = false;

        if (cond.type === 'story_count' && completedCount >= cond.threshold) met = true;
        else if (cond.type === 'word_count' && totalWords >= cond.threshold) met = true;

        if (met) {
          await this.prisma.userSticker.create({
            data: {
              userId,
              stickerDefId: def.id,
              relatedStoryId: storyId,
              isNew: true,
            },
          });
          newlyEarned.push(def.code);
          this.logger.log(`자동 스티커 부여: user=${userId} code=${def.code}`);
        }
      }

      return newlyEarned;
    } catch (err) {
      this.logger.error('자동 스티커 부여 실패:', err);
      return [];
    }
  }
}
