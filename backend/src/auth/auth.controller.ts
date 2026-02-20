import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RegisterTeacherDto } from './dto/register-teacher.dto';
import { LoginDto } from './dto/login.dto';
import { GuestLoginDto } from './dto/guest-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private configService: ConfigService,
  ) {}

  private get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  @Public()
  @Post('register-teacher')
  async registerTeacher(@Body() dto: RegisterTeacherDto) {
    const data = await this.authService.registerTeacher(dto);
    return { data };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto.loginId, dto.password);
    return { data };
  }

  @Public()
  @Post('guest')
  async guestLogin(@Body() dto: GuestLoginDto) {
    const data = await this.authService.guestLogin(dto.name);
    return { data };
  }

  // --- Google OAuth ---
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport가 Google 로그인 페이지로 리다이렉트
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const oauthUser = req.user as {
        email: string;
        name: string;
        provider: string;
        providerId: string;
      };
      const result = await this.authService.oauthLogin(oauthUser);
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      res.redirect(`${this.frontendUrl}/auth/callback?${params.toString()}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'auth_failed';
      const params = new URLSearchParams({ error: message });
      res.redirect(`${this.frontendUrl}/auth/callback?${params.toString()}`);
    }
  }

  // --- Microsoft OAuth ---
  @Public()
  @Get('microsoft')
  @UseGuards(AuthGuard('microsoft'))
  microsoftLogin() {
    // Passport가 Microsoft 로그인 페이지로 리다이렉트
  }

  @Public()
  @Get('microsoft/callback')
  @UseGuards(AuthGuard('microsoft'))
  async microsoftCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const oauthUser = req.user as {
        email: string;
        name: string;
        provider: string;
        providerId: string;
      };
      const result = await this.authService.oauthLogin(oauthUser);
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      res.redirect(`${this.frontendUrl}/auth/callback?${params.toString()}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'auth_failed';
      const params = new URLSearchParams({ error: message });
      res.redirect(`${this.frontendUrl}/auth/callback?${params.toString()}`);
    }
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    const data = await this.authService.changePassword(user.id, dto);
    return { data };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    const data = await this.authService.refreshTokens(dto.refreshToken);
    return { data };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Body() body: { refreshToken?: string },
  ) {
    const data = await this.authService.logout(user.id, body.refreshToken);
    return { data };
  }

  @Get('me')
  async getMe(@CurrentUser() user: User) {
    const { passwordHash, ...sanitized } = user;
    return { data: sanitized };
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.userService.updateProfile(user.id, dto);
    const { passwordHash, ...sanitized } = updated;
    return { data: sanitized };
  }
}
