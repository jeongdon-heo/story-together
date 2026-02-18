import { IsObject } from 'class-validator';

export class UpdateClassSettingsDto {
  @IsObject()
  settings: Record<string, any>;
}
