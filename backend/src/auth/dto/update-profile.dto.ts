import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatarIcon?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
