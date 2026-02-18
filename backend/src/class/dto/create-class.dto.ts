import { IsString, IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  grade?: number;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
