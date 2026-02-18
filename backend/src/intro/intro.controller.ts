import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { IsString, IsOptional, IsInt, IsObject, Min, Max } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { IntroService } from './intro.service';

class CreateIntroDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  introText: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  grade?: number;

  @IsOptional()
  @IsObject()
  themeData?: Record<string, any>;
}

class UpdateIntroDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  introText?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  grade?: number;
}

@Controller('intros')
@Roles('teacher')
export class IntroController {
  constructor(private introService: IntroService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateIntroDto) {
    const data = await this.introService.create(req.user.id, dto);
    return { data };
  }

  @Get()
  async findAll(@Req() req: any) {
    const data = await this.introService.findAll(req.user.id);
    return { data };
  }

  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.introService.findById(id, req.user.id);
    return { data };
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntroDto,
  ) {
    const data = await this.introService.update(id, req.user.id, dto);
    return { data };
  }

  @Delete(':id')
  async delete(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.introService.delete(id, req.user.id);
    return { data };
  }
}
