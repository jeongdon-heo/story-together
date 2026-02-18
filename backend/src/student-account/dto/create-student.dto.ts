import { IsString, IsInt, Min, Max, IsUUID } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  @Max(6)
  grade: number;

  @IsUUID()
  classId: string;
}
