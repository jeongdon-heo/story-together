import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
  ) {}

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

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin() {
    // 스켈레톤: 프론트에서 Google OAuth 토큰을 받아 처리
    return {
      data: null,
      error: 'Google OAuth가 아직 구성되지 않았습니다. GOOGLE_CLIENT_ID/SECRET을 설정하세요.',
    };
  }

  @Public()
  @Post('microsoft')
  @HttpCode(HttpStatus.OK)
  async microsoftLogin() {
    // 스켈레톤: 프론트에서 MS OAuth 토큰을 받아 처리
    return {
      data: null,
      error: 'Microsoft OAuth가 아직 구성되지 않았습니다. MS_CLIENT_ID/SECRET을 설정하세요.',
    };
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
