import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { ClassService } from './class.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateClassSettingsDto } from './dto/update-class-settings.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('classes')
export class ClassController {
  constructor(private classService: ClassService) {}

  @Post()
  @Roles('teacher')
  async create(@CurrentUser() user: User, @Body() dto: CreateClassDto) {
    const data = await this.classService.create(user.id, dto);
    return { data };
  }

  @Get()
  async getMyClasses(@CurrentUser() user: User) {
    const data = await this.classService.getMyClasses(user.id, user.role);
    return { data };
  }

  @Get(':id')
  async getById(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.classService.getById(user.id, user.role, id);
    return { data };
  }

  @Patch(':id')
  @Roles('teacher')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    const data = await this.classService.update(user.id, id, dto);
    return { data };
  }

  @Delete(':id')
  @Roles('teacher')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.classService.delete(user.id, id);
    return { data };
  }

  @Post(':id/regenerate-code')
  @Roles('teacher')
  async regenerateCode(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    const data = await this.classService.regenerateCode(user.id, id);
    return { data };
  }

  @Post('join')
  async join(@CurrentUser() user: User, @Body() dto: JoinClassDto) {
    const data = await this.classService.joinByCode(user.id, dto.joinCode);
    return { data };
  }

  @Get(':id/members')
  async getMembers(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.classService.getMembers(user.id, user.role, id);
    return { data };
  }

  @Patch(':id/members/:memberId')
  @Roles('teacher')
  async updateMember(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const data = await this.classService.updateMember(
      user.id,
      id,
      memberId,
      dto,
    );
    return { data };
  }

  @Delete(':id/members/:memberId')
  @Roles('teacher')
  async removeMember(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    const data = await this.classService.removeMember(user.id, id, memberId);
    return { data };
  }

  @Patch(':id/settings')
  @Roles('teacher')
  async updateSettings(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateClassSettingsDto,
  ) {
    const data = await this.classService.updateSettings(
      user.id,
      id,
      dto.settings,
    );
    return { data };
  }
}
