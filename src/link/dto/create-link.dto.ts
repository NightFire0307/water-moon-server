import { IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateLinkDto {
  @IsNotEmpty()
  order_id: number;

  @IsOptional()
  @Length(4, 6)
  password?: string;

  @IsNotEmpty()
  expired_at: number;
}
