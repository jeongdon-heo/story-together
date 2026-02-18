import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { BulkCreateStudentDto } from './dto/bulk-create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import {
  generateLoginId,
  generateInitialPassword,
} from './utils/korean-romanize';

@Injectable()
export class StudentAccountService {
  constructor(private prisma: PrismaService) {}

  // 개별 학생 계정 생성
  async createStudent(teacherId: string, dto: CreateStudentDto) {
    await this.verifyClassOwner(teacherId, dto.classId);

    const { loginId, initialPassword } = await this.generateCredentials(
      dto.name,
      dto.grade,
    );

    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        role: 'student',
        provider: 'local',
        loginId,
        passwordHash,
        grade: dto.grade,
        createdBy: teacherId,
        mustChangePassword: true,
      },
    });

    // 반에 등록
    await this.prisma.classMember.create({
      data: {
        userId: user.id,
        classId: dto.classId,
        role: 'student',
      },
    });

    return {
      userId: user.id,
      name: user.name,
      loginId,
      initialPassword,
      classId: dto.classId,
    };
  }

  // 일괄 학생 계정 생성
  async bulkCreateStudents(teacherId: string, dto: BulkCreateStudentDto) {
    await this.verifyClassOwner(teacherId, dto.classId);

    const accounts = [];

    for (const name of dto.names) {
      const { loginId, initialPassword } = await this.generateCredentials(
        name,
        dto.grade,
      );

      const passwordHash = await bcrypt.hash(initialPassword, 10);

      const user = await this.prisma.user.create({
        data: {
          name,
          role: 'student',
          provider: 'local',
          loginId,
          passwordHash,
          grade: dto.grade,
          createdBy: teacherId,
          mustChangePassword: true,
        },
      });

      await this.prisma.classMember.create({
        data: {
          userId: user.id,
          classId: dto.classId,
          role: 'student',
        },
      });

      accounts.push({
        userId: user.id,
        name: user.name,
        loginId,
        initialPassword,
      });
    }

    return { accounts, totalCreated: accounts.length };
  }

  // 내가 생성한 학생 목록
  async getMyStudents(teacherId: string) {
    const students = await this.prisma.user.findMany({
      where: { createdBy: teacherId, role: 'student' },
      include: {
        classMemberships: {
          include: {
            classRoom: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return students.map((s) => ({
      id: s.id,
      name: s.name,
      loginId: s.loginId,
      grade: s.grade,
      className: s.classMemberships[0]?.classRoom?.name || null,
      classId: s.classMemberships[0]?.classId || null,
      createdAt: s.createdAt,
    }));
  }

  // 반별 학생 목록
  async getStudentsByClass(teacherId: string, classId: string) {
    await this.verifyClassOwner(teacherId, classId);

    const members = await this.prisma.classMember.findMany({
      where: { classId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            loginId: true,
            grade: true,
            avatarIcon: true,
            createdAt: true,
          },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      loginId: m.user.loginId,
      grade: m.user.grade,
      avatarIcon: m.user.avatarIcon,
      displayName: m.displayName,
      color: m.color,
      orderIndex: m.orderIndex,
      joinedAt: m.joinedAt,
    }));
  }

  // 학생 정보 수정
  async updateStudent(
    teacherId: string,
    studentId: string,
    dto: UpdateStudentDto,
  ) {
    await this.verifyStudentOwner(teacherId, studentId);

    const updated = await this.prisma.user.update({
      where: { id: studentId },
      data: dto,
    });

    return {
      id: updated.id,
      name: updated.name,
      grade: updated.grade,
    };
  }

  // 비밀번호 초기화
  async resetPassword(teacherId: string, studentId: string) {
    const student = await this.verifyStudentOwner(teacherId, studentId);

    const newPassword = generateInitialPassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: studentId },
      data: { passwordHash, mustChangePassword: true },
    });

    return {
      userId: student.id,
      name: student.name,
      loginId: student.loginId,
      newPassword,
    };
  }

  // 반 이동
  async moveClass(
    teacherId: string,
    studentId: string,
    newClassId: string,
  ) {
    await this.verifyStudentOwner(teacherId, studentId);
    await this.verifyClassOwner(teacherId, newClassId);

    // 기존 반 멤버십 삭제
    await this.prisma.classMember.deleteMany({
      where: { userId: studentId },
    });

    // 새 반에 등록
    await this.prisma.classMember.create({
      data: {
        userId: studentId,
        classId: newClassId,
        role: 'student',
      },
    });

    return { message: '반 이동이 완료되었습니다' };
  }

  // 학생 비활성화 (soft delete - role 변경)
  async deactivateStudent(teacherId: string, studentId: string) {
    await this.verifyStudentOwner(teacherId, studentId);

    await this.prisma.classMember.deleteMany({
      where: { userId: studentId },
    });

    return { message: '학생 계정이 비활성화되었습니다' };
  }

  // 학생 삭제
  async deleteStudent(teacherId: string, studentId: string) {
    await this.verifyStudentOwner(teacherId, studentId);

    await this.prisma.user.delete({ where: { id: studentId } });

    return { message: '학생 계정이 삭제되었습니다' };
  }

  // CSV 내보내기 데이터
  async getExportData(teacherId: string, classId: string) {
    await this.verifyClassOwner(teacherId, classId);

    const classRoom = await this.prisma.classRoom.findUnique({
      where: { id: classId },
      select: { name: true },
    });

    const members = await this.prisma.classMember.findMany({
      where: { classId },
      include: {
        user: {
          select: { name: true, loginId: true, grade: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return {
      className: classRoom?.name || '',
      students: members.map((m) => ({
        name: m.user.name,
        loginId: m.user.loginId,
        grade: m.user.grade,
      })),
    };
  }

  // --- 헬퍼 메서드 ---

  // loginId 중복 방지를 위해 suffix 추가
  private async generateCredentials(name: string, grade: number) {
    let loginId = generateLoginId(name, grade);
    let suffix = 0;

    // 중복 체크
    while (await this.prisma.user.findUnique({ where: { loginId } })) {
      suffix++;
      loginId = generateLoginId(name, grade) + suffix;
    }

    const initialPassword = generateInitialPassword();

    return { loginId, initialPassword };
  }

  // 반 소유자 확인
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

  // 학생 소유자 확인
  private async verifyStudentOwner(teacherId: string, studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('학생을 찾을 수 없습니다');
    }

    if (student.createdBy !== teacherId) {
      throw new ForbiddenException('이 학생에 대한 권한이 없습니다');
    }

    return student;
  }
}
