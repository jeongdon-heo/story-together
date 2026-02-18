import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntroService {
  constructor(private prisma: PrismaService) {}

  async create(
    teacherId: string,
    data: {
      title?: string;
      introText: string;
      grade?: number;
      themeData?: Record<string, any>;
    },
  ) {
    return this.prisma.savedIntro.create({
      data: {
        teacherId,
        title: data.title,
        introText: data.introText,
        grade: data.grade,
        themeData: data.themeData,
      },
    });
  }

  async findAll(teacherId: string) {
    return this.prisma.savedIntro.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, teacherId: string) {
    const intro = await this.prisma.savedIntro.findUnique({ where: { id } });
    if (!intro) throw new NotFoundException('도입부를 찾을 수 없습니다');
    if (intro.teacherId !== teacherId) throw new ForbiddenException();
    return intro;
  }

  async update(
    id: string,
    teacherId: string,
    data: { title?: string; introText?: string; grade?: number },
  ) {
    await this.findById(id, teacherId);
    return this.prisma.savedIntro.update({ where: { id }, data });
  }

  async delete(id: string, teacherId: string) {
    await this.findById(id, teacherId);
    await this.prisma.savedIntro.delete({ where: { id } });
    return { message: '도입부가 삭제되었습니다' };
  }

  // 사용 횟수 증가 (세션에 사용할 때)
  async incrementUsedCount(id: string) {
    await this.prisma.savedIntro.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });
  }
}
