import { IsIn, IsOptional, IsString } from 'class-validator';

export class SelectionLoginDto {
  @IsIn(['link', 'order'])
  login_type: 'link' | 'order';

  @IsString()
  @IsOptional()
  short_url?: string;

  @IsString()
  @IsOptional()
  orderNumber?: string

  @IsString()
  credential: string;
}
