import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(configService: ConfigService) {
    const tenantId =
      configService.get<string>('MS_TENANT_ID') || 'common';

    super({
      clientID: configService.get<string>('MS_CLIENT_ID') || 'placeholder',
      clientSecret:
        configService.get<string>('MS_CLIENT_SECRET') || 'placeholder',
      callbackURL: '/auth/microsoft/callback',
      scope: ['user.read'],
      tenant: tenantId,
      authorizationURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenURL: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      displayName: string;
      emails?: Array<{ value: string; type?: string }>;
      _json?: { mail?: string; userPrincipalName?: string };
    },
    done: (error: Error | null, user?: Record<string, string>) => void,
  ): Promise<void> {
    const email =
      profile.emails?.[0]?.value ||
      profile._json?.mail ||
      profile._json?.userPrincipalName ||
      '';

    const user = {
      email,
      name: profile.displayName,
      provider: 'microsoft',
      providerId: profile.id,
    };
    done(null, user);
  }
}
