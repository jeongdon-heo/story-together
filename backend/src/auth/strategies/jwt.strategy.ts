import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';

export interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      this.logger.warn('JWT payload에 sub 없음');
      throw new UnauthorizedException('잘못된 토큰입니다');
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      this.logger.warn(`JWT 사용자 없음: sub=${payload.sub}, role=${payload.role}`);
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }

    return user;
  }
}
