import { IsString, MaxLength } from 'class-validator';

export class AddPartDto {
  @IsString()
  @MaxLength(1000)
  text: string;
}
