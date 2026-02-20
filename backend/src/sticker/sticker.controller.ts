import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsOptional, IsUUID, IsArray, IsNotEmpty } from 'class-validator';
import { StickerService } from './sticker.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

class AwardStickerDto {
  @IsUUID()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  stickerCode: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsUUID()
  relatedStoryId?: string;
}

class AwardBulkDto {
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds: string[];

  @IsString()
  @IsNotEmpty()
  stickerCode: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsUUID()
  relatedSessionId?: string;
}

class CreateCustomDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class AwardCustomDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsUUID()
  relatedStoryId?: string;
}

class SetFeaturedDto {
  @IsArray()
  featured: Array<{ position: number; stickerId: string }>;
}

@Controller('stickers')
export class StickerController {
  constructor(private readonly stickerService: StickerService) {}

  // ─── 공통 ─────────────────────────────────────────────────
  @Get('definitions')
  async getDefinitions() {
    const data = await this.stickerService.getDefinitions();
    return { data };
  }

  // ─── 학생/공통 ────────────────────────────────────────────
  @Get('my')
  async getMyStickers(@CurrentUser() user: any) {
    const data = await this.stickerService.getMyStickers(user.id);
    return { data };
  }

  @Post('my/:stickerId/read')
  @HttpCode(HttpStatus.OK)
  async readSticker(@CurrentUser() user: any, @Param('stickerId') stickerId: string) {
    const data = await this.stickerService.readSticker(user.id, stickerId);
    return { data };
  }

  @Put('my/featured')
  async setFeatured(@CurrentUser() user: any, @Body() dto: SetFeaturedDto) {
    const data = await this.stickerService.setFeatured(user.id, dto.featured);
    return { data };
  }

  // ─── 교사용 ───────────────────────────────────────────────
  @Get('user/:userId')
  @Roles('teacher')
  async getUserStickers(@Param('userId') userId: string) {
    const data = await this.stickerService.getUserStickers(userId);
    return { data };
  }

  @Post('award')
  @Roles('teacher')
  @HttpCode(HttpStatus.CREATED)
  async awardSticker(@CurrentUser() user: any, @Body() dto: AwardStickerDto) {
    const data = await this.stickerService.awardSticker(
      user.id,
      dto.studentId,
      dto.stickerCode,
      dto.comment,
      dto.relatedStoryId,
    );
    return { data };
  }

  @Post('award/bulk')
  @Roles('teacher')
  @HttpCode(HttpStatus.CREATED)
  async awardBulk(@CurrentUser() user: any, @Body() dto: AwardBulkDto) {
    const data = await this.stickerService.awardBulk(
      user.id,
      dto.studentIds,
      dto.stickerCode,
      dto.comment,
      dto.relatedSessionId,
    );
    return { data };
  }

  @Post('custom')
  @Roles('teacher')
  @HttpCode(HttpStatus.CREATED)
  async createCustom(@CurrentUser() user: any, @Body() dto: CreateCustomDto) {
    const data = await this.stickerService.createCustom(
      user.id,
      dto.name,
      dto.emoji,
      dto.description,
    );
    return { data };
  }

  @Get('custom')
  @Roles('teacher')
  async getMyCustom(@CurrentUser() user: any) {
    const data = await this.stickerService.getMyCustom(user.id);
    return { data };
  }

  @Delete('custom/:id')
  @Roles('teacher')
  async deleteCustom(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.stickerService.deleteCustom(id, user.id);
    return { data };
  }

  @Post('custom/:customId/award')
  @Roles('teacher')
  @HttpCode(HttpStatus.CREATED)
  async awardCustom(
    @CurrentUser() user: any,
    @Param('customId') customId: string,
    @Body() dto: AwardCustomDto,
  ) {
    const data = await this.stickerService.awardCustomSticker(
      user.id,
      customId,
      dto.studentId,
      dto.comment,
      dto.relatedStoryId,
    );
    return { data };
  }
}
