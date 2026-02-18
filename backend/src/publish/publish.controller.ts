import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { PublishService } from './publish.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

class PublishDto {
  @IsString()
  storyId: string;

  @IsOptional()
  @IsIn(['class', 'school', 'public'])
  scope?: string;
}

class CommentDto {
  @IsString()
  text: string;
}

@Controller()
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  // ─── 공개 신청 (학생) ─────────────────────────────────────────
  @Post('publish')
  @HttpCode(HttpStatus.CREATED)
  async publish(@CurrentUser() user: any, @Body() dto: PublishDto) {
    const data = await this.publishService.publish(
      user.userId,
      dto.storyId,
      dto.scope || 'class',
    );
    return { data };
  }

  // ─── 교사 승인/거부 ───────────────────────────────────────────
  @Patch('publish/:id/approve')
  @Roles('teacher')
  async approve(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.publishService.approve(user.userId, id);
    return { data };
  }

  @Patch('publish/:id/reject')
  @Roles('teacher')
  async reject(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.publishService.reject(user.userId, id);
    return { data };
  }

  // ─── 교사 승인 대기 목록 ──────────────────────────────────────
  @Get('publish/pending')
  @Roles('teacher')
  async getPending(@CurrentUser() user: any) {
    const data = await this.publishService.getPendingApproval(user.userId);
    return { data };
  }

  // ─── 내가 공개한 이야기 목록 ──────────────────────────────────
  @Get('publish/my')
  async getMyPublished(@CurrentUser() user: any) {
    const data = await this.publishService.getMyPublished(user.userId);
    return { data };
  }

  // ─── 탐색 (갤러리) ────────────────────────────────────────────
  @Get('explore')
  async explore(
    @Query('scope') scope?: string,
    @Query('grade') grade?: string,
    @Query('mode') mode?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('classId') classId?: string,
  ) {
    const data = await this.publishService.explore({
      scope,
      grade: grade ? Number(grade) : undefined,
      mode,
      sort,
      page: page ? Number(page) : 1,
      classId,
    });
    return { data };
  }

  // ─── 명예의 전당 ─────────────────────────────────────────────
  @Get('explore/hall-of-fame')
  async getHallOfFame() {
    const data = await this.publishService.getHallOfFame();
    return { data };
  }

  // ─── 이야기 상세 ─────────────────────────────────────────────
  @Get('explore/:id')
  async getById(@Param('id') id: string) {
    const data = await this.publishService.getById(id);
    return { data };
  }

  // ─── 좋아요 ───────────────────────────────────────────────────
  @Post('explore/:id/like')
  @HttpCode(HttpStatus.OK)
  async like(@Param('id') id: string) {
    const data = await this.publishService.like(id);
    return { data };
  }

  // ─── 댓글 ─────────────────────────────────────────────────────
  @Post('explore/:id/comment')
  @HttpCode(HttpStatus.CREATED)
  async comment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CommentDto,
  ) {
    const data = await this.publishService.addComment(user.userId, id, dto.text);
    return { data };
  }
}
