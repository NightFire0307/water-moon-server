import { IsNotEmpty } from 'class-validator';

export class CreateLinkDto {
  @IsNotEmpty()
  order_id: number;

  @IsNotEmpty()
  expires_at: string;
}
