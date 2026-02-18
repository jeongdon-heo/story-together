import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

// 스켈레톤: Google OAuth 키 발급 후 실제 연동
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'placeholder',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') || 'placeholder',
      callbackURL: '/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const user = {
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      provider: 'google',
      providerId: profile.id,
    };
    done(null, user);
  }
}
