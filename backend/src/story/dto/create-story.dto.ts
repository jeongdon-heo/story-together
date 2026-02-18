import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateStoryDto {
  @IsUUID()
  sessionId: string;

  @IsOptional()
  @IsString()
  aiCharacter?: string;
}
