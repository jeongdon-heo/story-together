import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { RegisterTeacherDto } from './dto/register-teacher.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '@prisma/client';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  // 교사 회원가입
  async registerTeacher(dto: RegisterTeacherDto) {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userService.createTeacher({
      email: dto.email,
      name: dto.name,
      passwordHash,
      schoolId: dto.schoolId,
    });

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  // 로컬 로그인 (학생/교사)
  async login(loginId: string, password: string) {
    const user = await this.validateLocalUser(loginId, password);
    if (!user) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다');
    }

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  // 교사 이메일 로그인
  async loginWithEmail(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  // 게스트 로그인
  async guestLogin(name: string) {
    const user = await this.userService.createGuest(name);
    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  // OAuth 로그인/가입 (Google)
  async oauthLogin(profile: {
    email: string;
    name: string;
    provider: string;
    providerId: string;
  }) {
    let user = await this.userService.findByProvider(
      profile.provider,
      profile.providerId,
    );

    if (!user) {
      // 이메일로 기존 사용자 확인
      const existingByEmail = await this.userService.findByEmail(profile.email);
      if (existingByEmail) {
        throw new ConflictException(
          '이미 다른 방식으로 가입된 이메일입니다',
        );
      }

      user = await this.userService.createOAuthUser({
        email: profile.email,
        name: profile.name,
        provider: profile.provider,
        providerId: profile.providerId,
        role: 'teacher', // OAuth 가입은 기본적으로 교사
      });
    }

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  // 비밀번호 변경
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userService.findById(userId);
    if (!user || !user.passwordHash) {
      throw new BadRequestException('비밀번호를 변경할 수 없는 계정입니다');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userService.updatePassword(userId, passwordHash);

    return { message: '비밀번호가 변경되었습니다', mustChangePassword: false };
  }

  // 토큰 갱신
  async refreshTokens(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // 만료된 토큰 삭제
      if (stored) {
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다');
    }

    // 토큰 로테이션: 기존 삭제 → 새로 발급
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens(stored.user);
    return { ...tokens, user: this.sanitizeUser(stored.user) };
  }

  // 로그아웃
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    } else {
      // 모든 리프레시 토큰 삭제
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }
    return { message: '로그아웃되었습니다' };
  }

  // 로컬 사용자 검증 (Passport LocalStrategy에서 호출)
  async validateLocalUser(
    loginId: string,
    password: string,
  ): Promise<User | null> {
    // loginId 또는 email로 검색
    let user = await this.userService.findByLoginId(loginId);
    if (!user) {
      user = await this.userService.findByEmail(loginId);
    }
    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  // JWT 토큰 쌍 생성
  private async generateTokens(user: User) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    return { accessToken, refreshToken };
  }

  private generateAccessToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  private async generateRefreshToken(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    return token;
  }

  // 민감 정보 제거
  private sanitizeUser(user: User) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
