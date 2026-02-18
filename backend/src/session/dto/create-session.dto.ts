import {
  IsString,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsString()
  mode: string; // solo, same_start, relay, branch

  @IsOptional()
  @IsString()
  title?: string;

  @IsObject()
  themeData: Record<string, any>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
