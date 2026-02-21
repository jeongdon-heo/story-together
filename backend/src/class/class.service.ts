import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class ClassService {
  constructor(private prisma: PrismaService) {}

  // 반 생성
  async create(teacherId: string, dto: CreateClassDto) {
    const joinCode = this.generateJoinCode();

    const classRoom = await this.prisma.classRoom.create({
      data: {
        name: dto.name,
        teacherId,
        grade: dto.grade,
        schoolId: dto.schoolId,
        joinCode,
      },
    });

    return {
      id: classRoom.id,
      name: classRoom.name,
      grade: classRoom.grade,
      joinCode: classRoom.joinCode,
      teacherId: classRoom.teacherId,
    };
  }

  // 내 반 목록 (교사: 내가 만든 반 / 학생: 소속된 반)
  async getMyClasses(userId: string, role: string) {
    if (role === 'teacher') {
      return this.prisma.classRoom.findMany({
        where: { teacherId: userId, isActive: true },
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 학생: 소속된 반
    const memberships = await this.prisma.classMember.findMany({
      where: { userId },
      include: {
        classRoom: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    return memberships.map((m) => m.classRoom);
  }

  // 반 상세 조회
  async getById(userId: string, role: string, classId: string) {
    const classRoom = await this.prisma.classRoom.findUnique({
      where: { id: classId },
      include: {
        _count: { select: { members: true } },
        teacher: { select: { id: true, name: true } },
        members: {
          include: {
            user: {
              select: { id: true, name: true, loginId: true, grade: true, avatarIcon: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!classRoom) {
      throw new NotFoundException('반을 찾을 수 없습니다');
    }

    // 접근 권한 확인
    if (role === 'teacher' && classRoom.teacherId !== userId) {
      throw new ForbiddenException('이 반에 대한 권한이 없습니다');
    }
    if (role === 'student') {
      const membership = await this.prisma.classMember.findFirst({
        where: { userId, classId },
      });
      if (!membership) {
        throw new ForbiddenException('이 반의 멤버가 아닙니다');
      }
    }

    return classRoom;
  }

  // 반 수정
  async update(teacherId: string, classId: string, dto: UpdateClassDto) {
    await this.verifyClassOwner(teacherId, classId);

    return this.prisma.classRoom.update({
      where: { id: classId },
      data: dto,
    });
  }

  // 반 삭제
  async delete(teacherId: string, classId: string) {
    await this.verifyClassOwner(teacherId, classId);

    await this.prisma.classRoom.delete({ where: { id: classId } });

    return { message: '반이 삭제되었습니다' };
  }

  // 참여 코드 재발급
  async regenerateCode(teacherId: string, classId: string) {
    await this.verifyClassOwner(teacherId, classId);

    const joinCode = this.generateJoinCode();

    await this.prisma.classRoom.update({
      where: { id: classId },
      data: { joinCode },
    });

    return { joinCode };
  }

  // 참여 코드로 반 참여 (학생)
  async joinByCode(userId: string, joinCode: string) {
    const classRoom = await this.prisma.classRoom.findUnique({
      where: { joinCode },
    });

    if (!classRoom || !classRoom.isActive) {
      throw new NotFoundException('유효하지 않은 참여 코드입니다');
    }

    // 이미 참여 중인지 확인
    const existing = await this.prisma.classMember.findFirst({
      where: { userId, classId: classRoom.id },
    });

    if (existing) {
      throw new ConflictException('이미 이 반에 참여하고 있습니다');
    }

    await this.prisma.classMember.create({
      data: {
        userId,
        classId: classRoom.id,
        role: 'student',
      },
    });

    const memberCount = await this.prisma.classMember.count({
      where: { classId: classRoom.id },
    });

    return {
      classId: classRoom.id,
      className: classRoom.name,
      memberCount,
    };
  }

  // 반 멤버 목록
  async getMembers(userId: string, role: string, classId: string) {
    // 접근 권한 확인
    await this.getById(userId, role, classId);

    const members = await this.prisma.classMember.findMany({
      where: { classId },
      include: {
        user: {
          select: { id: true, name: true, avatarIcon: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.displayName || m.user.name,
      avatarIcon: m.user.avatarIcon,
      color: m.color,
      orderIndex: m.orderIndex,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  // 멤버 정보 수정
  async updateMember(
    teacherId: string,
    classId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ) {
    await this.verifyClassOwner(teacherId, classId);

    const member = await this.prisma.classMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.classId !== classId) {
      throw new NotFoundException('멤버를 찾을 수 없습니다');
    }

    return this.prisma.classMember.update({
      where: { id: memberId },
      data: dto,
    });
  }

  // 멤버 삭제 (교사가 학생을 반에서 제거)
  async removeMember(
    teacherId: string,
    classId: string,
    memberId: string,
  ) {
    await this.verifyClassOwner(teacherId, classId);

    const member = await this.prisma.classMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.classId !== classId) {
      throw new NotFoundException('멤버를 찾을 수 없습니다');
    }

    await this.prisma.classMember.delete({ where: { id: memberId } });

    return { message: '멤버가 반에서 제거되었습니다' };
  }

  // 반 설정 업데이트
  async updateSettings(
    teacherId: string,
    classId: string,
    settings: Record<string, any>,
  ) {
    const classRoom = await this.verifyClassOwner(teacherId, classId);

    // 기존 설정과 병합
    const currentSettings =
      typeof classRoom.settings === 'object' && classRoom.settings !== null
        ? (classRoom.settings as Record<string, any>)
        : {};
    const mergedSettings = { ...currentSettings, ...settings };

    return this.prisma.classRoom.update({
      where: { id: classId },
      data: { settings: mergedSettings },
    });
  }

  // --- 헬퍼 ---

  private async verifyClassOwner(teacherId: string, classId: string) {
    const classRoom = await this.prisma.classRoom.findUnique({
      where: { id: classId },
    });

    if (!classRoom) {
      throw new NotFoundException('반을 찾을 수 없습니다');
    }

    if (classRoom.teacherId !== teacherId) {
      throw new ForbiddenException('이 반에 대한 권한이 없습니다');
    }

    return classRoom;
  }

  private generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
