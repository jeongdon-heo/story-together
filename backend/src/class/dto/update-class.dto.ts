import { IsString, IsInt, Min, Max, IsOptional, IsBoolean } from 'class-validator';

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  grade?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
