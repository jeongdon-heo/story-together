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

  async create(userId: string, role: string, dto: CreateSessionDto) {
    // solo 모드는 classId 없이 생성 가능
    if (dto.mode !== 'solo' && !dto.classId) {
      throw new ForbiddenException('그룹 모드는 반이 필요합니다');
    }

    // solo 모드에서 classId 없으면 임시 세션 (게스트/학생 직접 시작)
    if (dto.mode === 'solo' && !dto.classId) {
      // 사용자의 첫 번째 반을 찾거나, 없으면 classId null 허용
      const membership = await this.prisma.classMember.findFirst({
        where: { userId },
        select: { classId: true },
      });

      // 반이 없는 경우(게스트) — 더미 세션 생성을 위해 첫 반 사용 또는 에러
      // 현재 스키마상 classId는 필수이므로 반이 필요함
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

    // 게스트를 위한 특수 처리: classId 없이도 세션 생성
    // 스키마에서 classId가 필수이므로, 게스트용 더미 처리가 필요
    // 현재는 게스트가 반에 소속되지 않으면 에러
    if (!dto.classId) {
      throw new ForbiddenException('반 정보가 필요합니다');
    }

    const session = await this.prisma.session.create({
      data: {
        classId: dto.classId,
        mode: dto.mode,
        title: dto.title,
        themeData: dto.themeData,
        settings: dto.settings || {},
        status: 'active',
      },
    });

    return session;
  }

  async findById(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        stories: { include: { parts: { orderBy: { order: 'asc' } } } },
      },
    });

    if (!session) {
      throw new NotFoundException('세션을 찾을 수 없습니다');
    }

    return session;
  }

  async findMany(filters: {
    classId?: string;
    mode?: string;
    status?: string;
  }) {
    return this.prisma.session.findMany({
      where: {
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.mode && { mode: filters.mode }),
        ...(filters.status && { status: filters.status }),
      },
      include: { _count: { select: { stories: true } } },
      orderBy: { createdAt: 'desc' },
    });
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
