import { IsString } from 'class-validator';

export class SelectionLoginDto {
  @IsString()
  short_url: string;

  @IsString()
  password: string;
}
