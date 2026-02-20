import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }

  async create(userId: string, role: string, dto: CreateSessionDto) {
    // solo 모드는 classId 없이 생성 가능
    if (dto.mode !== 'solo' && !dto.classId) {
      throw new ForbiddenException('그룹 모드는 반이 필요합니다');
    }

    // solo 모드에서 classId 없으면 임시 세션 (게스트/학생 직접 시작)
    if (dto.mode === 'solo' && !dto.classId) {
      const membership = await this.prisma.classMember.findFirst({
        where: { userId },
        select: { classId: true },
      });

      if (!membership && role !== 'guest') {
        throw new ForbiddenException('소속된 반이 없습니다');
      }

      dto.classId = membership?.classId;
    }

    // 반 모드 권한 확인 (교사만 그룹 세션 생성)
    if (dto.mode !== 'solo' && role === 'teacher' && dto.classId) {
      const classRoom = await this.prisma.classRoom.findUnique({
        where: { id: dto.classId },
      });
      if (!classRoom || classRoom.teacherId !== userId) {
        throw new ForbiddenException('이 반에 대한 권한이 없습니다');
      }
    }

    if (!dto.classId) {
      throw new ForbiddenException('반 정보가 필요합니다');
    }

    // 릴레이/분기 모드는 shortCode 자동 생성
    let shortCode: string | undefined;
    if (dto.mode === 'relay' || dto.mode === 'branch' || dto.mode === 'same_start') {
      let attempts = 0;
      while (!shortCode && attempts < 10) {
        const candidate = this.generateShortCode();
        const exists = await this.prisma.session.findUnique({
          where: { shortCode: candidate },
        });
        if (!exists) shortCode = candidate;
        attempts++;
      }
    }

    // 모둠 모드: groups 초기화
    let settings = dto.settings || {};
    if (dto.mode === 'same_start' && settings.participationType === 'group') {
      const groupCount = Math.max(2, Math.min(10, settings.groupCount || 4));
      const groups: Record<string, { name: string; memberIds: string[] }> = {};
      for (let i = 1; i <= groupCount; i++) {
        groups[String(i)] = { name: `${i}모둠`, memberIds: [] };
      }
      settings = { ...settings, groupCount, groups };
    }

    const session = await this.prisma.session.create({
      data: {
        classId: dto.classId,
        mode: dto.mode,
        title: dto.title,
        themeData: dto.themeData,
        settings,
        status: 'active',
        ...(shortCode && { shortCode }),
      },
    });

    return session;
  }

  async findById(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        stories: { include: { parts: { orderBy: { order: 'asc' } } } },
        classRoom: { select: { name: true, grade: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('세션을 찾을 수 없습니다');
    }

    return session;
  }

  async findByShortCode(shortCode: string) {
    const session = await this.prisma.session.findUnique({
      where: { shortCode: shortCode.toUpperCase() },
      select: { id: true, mode: true, status: true, title: true, shortCode: true },
    });

    if (!session) {
      throw new NotFoundException('입장 코드를 찾을 수 없습니다');
    }

    if (session.status === 'completed') {
      throw new ForbiddenException('이미 종료된 세션입니다');
    }

    return session;
  }

  async findMany(filters: {
    classId?: string;
    mode?: string;
    status?: string;
    teacherId?: string;
  }) {
    return this.prisma.session.findMany({
      where: {
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.mode && { mode: filters.mode }),
        ...(filters.status && { status: filters.status }),
        ...(filters.teacherId && {
          classRoom: { teacherId: filters.teacherId },
        }),
      },
      include: {
        _count: { select: { stories: true } },
        classRoom: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 모둠 참여
  async joinGroup(sessionId: string, userId: string, groupNumber: number) {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const settings = (session.settings as Record<string, any>) || {};

    if (settings.participationType !== 'group') {
      throw new ForbiddenException('이 세션은 모둠 모드가 아닙니다');
    }
    if (groupNumber < 1 || groupNumber > (settings.groupCount || 1)) {
      throw new ForbiddenException('유효하지 않은 모둠 번호입니다');
    }

    const groups = settings.groups || {};

    // 기존 모둠에서 제거
    for (const key of Object.keys(groups)) {
      if (groups[key].memberIds) {
        groups[key].memberIds = groups[key].memberIds.filter(
          (id: string) => id !== userId,
        );
      }
    }

    // 새 모둠에 추가
    const groupKey = String(groupNumber);
    if (!groups[groupKey]) {
      groups[groupKey] = { name: `${groupNumber}모둠`, memberIds: [] };
    }
    if (!groups[groupKey].memberIds.includes(userId)) {
      groups[groupKey].memberIds.push(userId);
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { settings: { ...settings, groups } },
    });

    return { groupNumber, groupName: groups[groupKey].name };
  }

  // 내 모둠 조회
  async getMyGroup(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const settings = (session.settings as Record<string, any>) || {};

    if (settings.participationType !== 'group') return null;

    const groups = settings.groups || {};
    for (const [key, group] of Object.entries(groups)) {
      if ((group as any).memberIds?.includes(userId)) {
        return { groupNumber: Number(key), groupName: (group as any).name };
      }
    }
    return null;
  }

  async updateStatus(
    id: string,
    status: string,
    teacherId?: string,
  ) {
    const session = await this.findById(id);

    if (teacherId) {
      const classRoom = await this.prisma.classRoom.findUnique({
        where: { id: session.classId },
      });
      if (!classRoom || classRoom.teacherId !== teacherId) {
        throw new ForbiddenException('이 세션에 대한 권한이 없습니다');
      }
    }

    return this.prisma.session.update({
      where: { id },
      data: {
        status,
        ...(status === 'completed' && { completedAt: new Date() }),
      },
    });
  }
}
