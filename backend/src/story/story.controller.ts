import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { StoryService } from './story.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { AddPartDto } from './dto/add-part.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('stories')
export class StoryController {
  constructor(private storyService: StoryService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateStoryDto) {
    const data = await this.storyService.create(user.id, dto);
    return { data };
  }

  @Get('my')
  async findMyStories(
    @CurrentUser() user: User,
    @Query('mode') mode?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    const data = await this.storyService.findMyStories(user.id, {
      mode,
      status,
      sort,
    });
    return { data };
  }

  @Get()
  async findMany(
    @Query('sessionId') sessionId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.storyService.findMany({
      sessionId,
      userId,
      status,
    });
    return { data };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.storyService.findById(id);
    return { data };
  }

  @Post(':id/parts')
  async addPart(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: AddPartDto,
  ) {
    const data = await this.storyService.addPart(id, user.id, dto.text);
    return { data };
  }

  @Patch(':id/parts/:partId')
  @Roles('teacher')
  async updatePart(
    @Param('partId') partId: string,
    @Body() dto: AddPartDto,
  ) {
    const data = await this.storyService.updatePart(partId, dto.text);
    return { data };
  }

  @Delete(':id/parts/:partId')
  @Roles('teacher')
  async deletePart(@Param('partId') partId: string) {
    const data = await this.storyService.deletePart(partId);
    return { data };
  }

  @Post(':id/complete')
  async complete(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    const data = await this.storyService.complete(id, user.id);
    return { data };
  }

  @Patch(':id/flag/:partId')
  @Roles('teacher')
  async flagPart(@Param('partId') partId: string) {
    const data = await this.storyService.flagPart(partId);
    return { data };
  }
}
