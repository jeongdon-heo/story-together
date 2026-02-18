import { IsString, IsInt, IsOptional } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  orderIndex?: number;

  @IsOptional()
  @IsString()
  displayName?: string;
}
