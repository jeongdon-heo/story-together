import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  grade?: number;
}
