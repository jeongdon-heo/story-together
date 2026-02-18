import { IsString, MaxLength } from 'class-validator';

export class GuestLoginDto {
  @IsString()
  @MaxLength(100)
  name: string;
}
