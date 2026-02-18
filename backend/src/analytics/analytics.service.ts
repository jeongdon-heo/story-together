import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // 반별 통계
  async getClassAnalytics(classId: string) {
    const classRoom = await this.prisma.classRoom.findUnique({
      where: { id: classId },
      include: { members: true },
    });
    if (!classRoom) throw new NotFoundException('반을 찾을 수 없습니다.');

    const sessions = await this.prisma.session.findMany({
      where: { classId },
      include: {
        stories: {
          include: { parts: true },
        },
      },
    });

    const allStories = sessions.flatMap((s) => s.stories);
    const completedStories = allStories.filter((s) => s.status === 'completed');

    const totalWords = allStories.reduce(
      (sum, story) => sum + (story.metadata as any)?.wordCount || 0,
      0,
    );
    const totalTurns = allStories.reduce(
      (sum, story) => sum + (story.metadata as any)?.totalTurns || 0,
      0,
    );

    const modeBreakdown = sessions.reduce(
      (acc, session) => {
        acc[session.mode] = (acc[session.mode] || 0) + session.stories.length;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 최근 7일 이야기 수
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentStories = allStories.filter(
      (s) => new Date(s.createdAt) >= sevenDaysAgo,
    );

    return {
      classId,
      className: classRoom.name,
      totalStudents: classRoom.members.length,
      totalSessions: sessions.length,
      totalStories: allStories.length,
      completedStories: completedStories.length,
      avgWordsPerStory:
        allStories.length > 0 ? Math.round(totalWords / allStories.length) : 0,
      avgTurnsPerStory:
        allStories.length > 0 ? Math.round(totalTurns / allStories.length) : 0,
      modeBreakdown,
      recentStoriesCount: recentStories.length,
    };
  }

  // 세션별 통계
  async getSessionAnalytics(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        stories: {
          include: {
            parts: true,
            user: { select: { id: true, name: true, avatarIcon: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('세션을 찾을 수 없습니다.');

    const studentStories = session.stories.filter((s) => s.userId !== null);
    const totalWords = session.stories.reduce(
      (sum, s) => sum + ((s.metadata as any)?.wordCount || 0),
      0,
    );

    // 학생별 기여도
    const studentStats = studentStories.map((story) => {
      const studentParts = story.parts.filter((p) => p.authorType === 'student');
      const wordCount = studentParts.reduce((sum, p) => sum + p.text.length, 0);
      return {
        userId: story.userId,
        name: story.user?.name || '익명',
        storyId: story.id,
        status: story.status,
        partsCount: studentParts.length,
        wordCount,
        flaggedCount: story.parts.filter((p) => p.flagged).length,
      };
    });

    // 플래그된 파트
    const flaggedParts = session.stories.flatMap((story) =>
      story.parts
        .filter((p) => p.flagged)
        .map((p) => ({
          partId: p.id,
          storyId: story.id,
          authorId: p.authorId,
          text: p.text,
          createdAt: p.createdAt,
        })),
    );

    return {
      sessionId,
      title: session.title,
      mode: session.mode,
      status: session.status,
      totalStories: session.stories.length,
      completedStories: session.stories.filter((s) => s.status === 'completed').length,
      totalWords,
      studentStats,
      flaggedParts,
      flaggedCount: flaggedParts.length,
    };
  }

  // 학생별 통계
  async getStudentAnalytics(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, grade: true },
    });
    if (!user) throw new NotFoundException('학생을 찾을 수 없습니다.');

    const stories = await this.prisma.story.findMany({
      where: { userId },
      include: { parts: true },
    });

    const completed = stories.filter((s) => s.status === 'completed');
    const totalWords = stories.reduce(
      (sum, s) => sum + ((s.metadata as any)?.wordCount || 0),
      0,
    );
    const studentParts = stories.flatMap((s) =>
      s.parts.filter((p) => p.authorType === 'student'),
    );
    const avgWordsPerTurn =
      studentParts.length > 0
        ? Math.round(
            studentParts.reduce((sum, p) => sum + p.text.length, 0) /
              studentParts.length,
          )
        : 0;

    // 모드별 이야기 수
    const storiesByMode = await this.prisma.session.findMany({
      where: {
        stories: { some: { userId } },
      },
      select: { mode: true },
    });
    const modeBreakdown = storiesByMode.reduce(
      (acc, s) => {
        acc[s.mode] = (acc[s.mode] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      userId,
      name: user.name,
      grade: user.grade,
      totalStories: stories.length,
      completedStories: completed.length,
      totalWords,
      avgWordsPerTurn,
      modeBreakdown,
      recentStories: stories
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          status: s.status,
          wordCount: (s.metadata as any)?.wordCount || 0,
          createdAt: s.createdAt,
        })),
    };
  }

  // 같은 시작 모드 — 세션별 비교 분석
  async getSessionComparison(sessionId: string) {
    const stories = await this.prisma.story.findMany({
      where: { sessionId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        user: { select: { id: true, name: true } },
      },
    });

    return stories.map((story) => {
      const studentParts = story.parts.filter(
        (p) => p.authorType === 'student' && !(p.metadata as any)?.isIntro,
      );
      return {
        storyId: story.id,
        studentName: story.user?.name || '익명',
        status: story.status,
        wordCount: (story.metadata as any)?.wordCount || 0,
        turnCount: studentParts.length,
        preview: studentParts[0]?.text.slice(0, 60) || '',
      };
    });
  }
}
