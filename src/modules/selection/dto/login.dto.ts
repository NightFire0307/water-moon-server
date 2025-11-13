import { IsIn, IsOptional, IsString } from 'class-validator';

export class SelectionLoginDto {
  @IsIn(['link', 'order'])
  loginType: 'link' | 'order';

  @IsString()
  @IsOptional()
  shortUrl?: string;

  @IsString()
  @IsOptional()
  orderNumber?: string

  @IsString()
  credential: string;
}
