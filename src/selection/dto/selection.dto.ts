import { IsString } from 'class-validator';

export class SelectionDto {
  @IsString()
  short_url: string;

  @IsString()
  password: string;
}
