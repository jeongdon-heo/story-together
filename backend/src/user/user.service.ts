import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByLoginId(loginId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { loginId } });
  }

  async findByProvider(
    provider: string,
    providerId: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { provider, providerId },
    });
  }

  async createTeacher(data: {
    email: string;
    name: string;
    passwordHash: string;
    schoolId?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: 'teacher',
        provider: 'local',
        passwordHash: data.passwordHash,
        schoolId: data.schoolId,
      },
    });
  }

  async createOAuthUser(data: {
    email: string;
    name: string;
    provider: string;
    providerId: string;
    role: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        provider: data.provider,
        providerId: data.providerId,
      },
    });
  }

  async createGuest(name: string): Promise<User> {
    return this.prisma.user.create({
      data: {
        name,
        role: 'guest',
        provider: 'guest',
      },
    });
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });
  }

  async updateProfile(
    userId: string,
    data: { name?: string; avatarIcon?: string; settings?: any },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async getUserClassIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.classMember.findMany({
      where: { userId },
      select: { classId: true },
    });
    return memberships.map((m) => m.classId);
  }
}
