import { IsUUID } from 'class-validator';

export class MoveClassDto {
  @IsUUID()
  newClassId: string;
}
