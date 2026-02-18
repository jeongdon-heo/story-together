import {
  IsArray,
  IsInt,
  IsString,
  Min,
  Max,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';

export class BulkCreateStudentDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  names: string[];

  @IsInt()
  @Min(1)
  @Max(6)
  grade: number;

  @IsUUID()
  classId: string;
}
