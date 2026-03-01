import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('sessions')
export class SessionController {
  constructor(
    private sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateSessionDto) {
    const data = await this.sessionService.create(user.id, user.role, dto);
    return { data };
  }

  @Get()
  async findMany(
    @CurrentUser() user: User,
    @Query('classId') classId?: string,
    @Query('mode') mode?: string,
    @Query('status') status?: string,
  ) {
    // 교사는 자기 반 세션만 조회
    const teacherId = user.role === 'teacher' ? user.id : undefined;
    const data = await this.sessionService.findMany({ classId, mode, status, teacherId });
    return { data };
  }

  // 단축코드로 세션 조회 (학생 입장용, 인증 불필요)
  @Public()
  @Get('join/:code')
  async findByCode(@Param('code') code: string) {
    const data = await this.sessionService.findByShortCode(code);
    return { data };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.sessionService.findById(id);
    return { data };
  }

  // 모둠 참여
  @Post(':id/join-group')
  async joinGroup(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body('groupNumber') groupNumber: number,
  ) {
    const data = await this.sessionService.joinGroup(id, user.id, groupNumber);
    return { data };
  }

  // 내 모둠 조회
  @Get(':id/my-group')
  async getMyGroup(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    const data = await this.sessionService.getMyGroup(id, user.id);
    return { data };
  }

  @Patch(':id')
  @Roles('teacher')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { title?: string },
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { classRoom: true },
    });
    if (!session || !session.classRoom || session.classRoom.teacherId !== user.id) {
      return { data: null, error: 'Not found or unauthorized' };
    }
    const data = await this.prisma.session.update({
      where: { id },
      data: { ...(dto.title && { title: dto.title }) },
    });
    return { data };
  }

  @Post(':id/pause')
  @Roles('teacher')
  async pause(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.sessionService.updateStatus(id, 'paused', user.id);
    return { data };
  }

  @Post(':id/resume')
  @Roles('teacher')
  async resume(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.sessionService.updateStatus(id, 'active', user.id);
    return { data };
  }

  @Post(':id/complete')
  @Roles('teacher')
  async complete(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.sessionService.updateStatus(
      id,
      'completed',
      user.id,
    );
    return { data };
  }

  // 모둠별 이야기 조회 (같은 시작 모둠 모드)
  @Get(':id/group-story/:groupNumber')
  async getGroupStory(
    @Param('id') id: string,
    @Param('groupNumber') groupNumber: string,
  ) {
    const stories = await this.prisma.story.findMany({
      where: { sessionId: id },
      include: { parts: { orderBy: { order: 'asc' } } },
    });
    const groupStory = stories.find(
      (s) => (s.metadata as any)?.groupNumber === parseInt(groupNumber),
    );
    return { data: groupStory || null };
  }

  // 같은 시작 모드: 갤러리 (세션 내 모든 완성 이야기 목록)
  @Get(':id/gallery')
  async getGallery(@Param('id') id: string) {
    const stories = await this.prisma.story.findMany({
      where: { sessionId: id },
      include: {
        parts: { orderBy: { order: 'asc' } },
        user: { select: { id: true, name: true, avatarIcon: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { data: stories };
  }
}
