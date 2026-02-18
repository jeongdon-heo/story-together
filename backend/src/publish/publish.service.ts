import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 12;

@Injectable()
export class PublishService {
  constructor(private prisma: PrismaService) {}

  // ─── 이야기 공개 신청 (학생) ──────────────────────────────────
  async publish(userId: string, storyId: string, scope: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { session: { include: { classRoom: true } } },
    });

    if (!story) throw new NotFoundException('이야기를 찾을 수 없습니다.');
    if (story.status !== 'completed') {
      throw new BadRequestException('완성된 이야기만 공개할 수 있습니다.');
    }
    if (story.userId !== userId) {
      throw new ForbiddenException('본인의 이야기만 공개할 수 있습니다.');
    }

    // 이미 공개된 경우 기존 레코드 반환
    const existing = await this.prisma.publishedStory.findUnique({
      where: { storyId },
    });
    if (existing) {
      return existing;
    }

    const classId = story.session?.classRoom?.id;
    if (!classId) throw new BadRequestException('반 정보가 없어 공개할 수 없습니다.');

    const validScopes = ['class', 'school', 'public'];
    const finalScope = validScopes.includes(scope) ? scope : 'class';

    return this.prisma.publishedStory.create({
      data: {
        storyId,
        classId,
        scope: finalScope,
        approvedBy: null, // 교사 승인 대기
      },
    });
  }

  // ─── 교사 승인 ────────────────────────────────────────────────
  async approve(teacherId: string, publishedId: string) {
    const pub = await this.prisma.publishedStory.findUnique({
      where: { id: publishedId },
      include: { classRoom: true },
    });
    if (!pub) throw new NotFoundException('공개 신청을 찾을 수 없습니다.');
    if (pub.classRoom.teacherId !== teacherId) {
      throw new ForbiddenException('해당 반의 교사만 승인할 수 있습니다.');
    }
    return this.prisma.publishedStory.update({
      where: { id: publishedId },
      data: { approvedBy: teacherId },
    });
  }

  // ─── 교사 거부 (삭제) ─────────────────────────────────────────
  async reject(teacherId: string, publishedId: string) {
    const pub = await this.prisma.publishedStory.findUnique({
      where: { id: publishedId },
      include: { classRoom: true },
    });
    if (!pub) throw new NotFoundException('공개 신청을 찾을 수 없습니다.');
    if (pub.classRoom.teacherId !== teacherId) {
      throw new ForbiddenException('해당 반의 교사만 거부할 수 있습니다.');
    }
    await this.prisma.publishedStory.delete({ where: { id: publishedId } });
    return { message: '이야기 공개 신청이 거부되었습니다.' };
  }

  // ─── 승인 대기 목록 (교사용) ──────────────────────────────────
  async getPendingApproval(teacherId: string) {
    const pending = await this.prisma.publishedStory.findMany({
      where: {
        approvedBy: null,
        classRoom: { teacherId },
      },
      include: {
        story: {
          select: {
            id: true,
            userId: true,
            aiCharacter: true,
            createdAt: true,
            user: { select: { name: true } },
            parts: { orderBy: { order: 'asc' }, take: 1 },
            session: { select: { mode: true } },
          },
        },
        classRoom: { select: { name: true, grade: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return pending.map((p) => ({
      id: p.id,
      storyId: p.storyId,
      scope: p.scope,
      publishedAt: p.publishedAt,
      classRoom: p.classRoom,
      story: {
        id: p.story.id,
        authorName: p.story.user?.name || '학생',
        mode: p.story.session?.mode || 'solo',
        preview: p.story.parts[0]?.text.slice(0, 100) || '',
        createdAt: p.story.createdAt,
      },
    }));
  }

  // ─── 탐색 (공개된 이야기 목록) ───────────────────────────────
  async explore(params: {
    scope?: string;
    grade?: number;
    mode?: string;
    sort?: string;
    page?: number;
    classId?: string;
  }) {
    const { scope, grade, mode, sort = 'recent', page = 1, classId } = params;
    const skip = (page - 1) * PAGE_SIZE;

    const where: any = {
      approvedBy: { not: null },
      ...(scope && { scope }),
      ...(classId && { classId }),
      story: {
        session: {
          ...(mode && { mode }),
          classRoom: {
            ...(grade && { grade: Number(grade) }),
          },
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.publishedStory.findMany({
        where,
        include: {
          story: {
            select: {
              id: true,
              userId: true,
              aiCharacter: true,
              coverUrl: true,
              user: { select: { name: true } },
              parts: { orderBy: { order: 'asc' }, take: 1 },
              illustrations: { where: { isCover: true }, take: 1 },
              session: { select: { mode: true } },
              _count: { select: { parts: true } },
            },
          },
          classRoom: { select: { name: true, grade: true } },
          _count: { select: { comments: true } },
        },
        orderBy: sort === 'popular' ? { likeCount: 'desc' } : { publishedAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.publishedStory.count({ where }),
    ]);

    const list = items.map((p) => ({
      id: p.id,
      storyId: p.storyId,
      scope: p.scope,
      likeCount: p.likeCount,
      commentCount: p._count.comments,
      publishedAt: p.publishedAt,
      classRoom: p.classRoom,
      story: {
        id: p.story.id,
        authorName: p.story.user?.name || '학생',
        mode: p.story.session?.mode || 'solo',
        preview: p.story.parts[0]?.text.slice(0, 120) || '',
        coverUrl: p.story.illustrations[0]?.imageUrl || p.story.coverUrl || null,
        partCount: p.story._count.parts,
      },
    }));

    return {
      items: list,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  // ─── 이야기 상세 ─────────────────────────────────────────────
  async getById(publishedId: string) {
    const pub = await this.prisma.publishedStory.findUnique({
      where: { id: publishedId },
      include: {
        story: {
          include: {
            parts: { orderBy: { order: 'asc' } },
            user: { select: { name: true } },
            illustrations: { orderBy: { sceneIndex: 'asc' } },
            session: { select: { mode: true } },
          },
        },
        classRoom: { select: { name: true, grade: true } },
        comments: {
          where: { flagged: false },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pub) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    return {
      id: pub.id,
      storyId: pub.storyId,
      scope: pub.scope,
      likeCount: pub.likeCount,
      publishedAt: pub.publishedAt,
      classRoom: pub.classRoom,
      story: {
        id: pub.story.id,
        authorName: pub.story.user?.name || '학생',
        mode: pub.story.session?.mode || 'solo',
        parts: pub.story.parts,
        illustrations: pub.story.illustrations,
      },
      comments: pub.comments.map((c) => ({
        id: c.id,
        text: c.text,
        author: c.user.name,
        createdAt: c.createdAt,
      })),
    };
  }

  // ─── 좋아요 ───────────────────────────────────────────────────
  async like(publishedId: string) {
    const pub = await this.prisma.publishedStory.findUnique({
      where: { id: publishedId },
    });
    if (!pub) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    const updated = await this.prisma.publishedStory.update({
      where: { id: publishedId },
      data: { likeCount: { increment: 1 } },
    });
    return { likeCount: updated.likeCount };
  }

  // ─── 댓글 달기 ───────────────────────────────────────────────
  async addComment(userId: string, publishedId: string, text: string) {
    const pub = await this.prisma.publishedStory.findUnique({
      where: { id: publishedId },
    });
    if (!pub) throw new NotFoundException('이야기를 찾을 수 없습니다.');

    const comment = await this.prisma.comment.create({
      data: { publishedId, userId, text },
      include: { user: { select: { name: true } } },
    });

    return {
      id: comment.id,
      text: comment.text,
      author: comment.user.name,
      createdAt: comment.createdAt,
    };
  }

  // ─── 명예의 전당 ─────────────────────────────────────────────
  async getHallOfFame() {
    const top = await this.prisma.publishedStory.findMany({
      where: { approvedBy: { not: null } },
      include: {
        story: {
          select: {
            id: true,
            user: { select: { name: true } },
            parts: { orderBy: { order: 'asc' }, take: 1 },
            illustrations: { where: { isCover: true }, take: 1 },
            session: { select: { mode: true } },
            _count: { select: { parts: true } },
          },
        },
        classRoom: { select: { name: true, grade: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { likeCount: 'desc' },
      take: 10,
    });

    return top.map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      storyId: p.storyId,
      likeCount: p.likeCount,
      commentCount: p._count.comments,
      publishedAt: p.publishedAt,
      classRoom: p.classRoom,
      story: {
        id: p.story.id,
        authorName: p.story.user?.name || '학생',
        mode: p.story.session?.mode || 'solo',
        preview: p.story.parts[0]?.text.slice(0, 100) || '',
        coverUrl: p.story.illustrations[0]?.imageUrl || null,
        partCount: p.story._count.parts,
      },
    }));
  }

  // ─── 내가 공개한 이야기 목록 ──────────────────────────────────
  async getMyPublished(userId: string) {
    const list = await this.prisma.publishedStory.findMany({
      where: { story: { userId } },
      include: {
        story: {
          select: {
            id: true,
            parts: { orderBy: { order: 'asc' }, take: 1 },
            session: { select: { mode: true } },
          },
        },
        _count: { select: { comments: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return list.map((p) => ({
      id: p.id,
      storyId: p.storyId,
      scope: p.scope,
      likeCount: p.likeCount,
      commentCount: p._count.comments,
      isApproved: !!p.approvedBy,
      publishedAt: p.publishedAt,
      mode: p.story.session?.mode || 'solo',
      preview: p.story.parts[0]?.text.slice(0, 80) || '',
    }));
  }
}
