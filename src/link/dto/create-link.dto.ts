import { IsNotEmpty } from 'class-validator';

export class CreateLinkDto {
  @IsNotEmpty()
  order_id: number;

  @IsNotEmpty({ message: '过期时间不能为空' })
  expires_at: number;
}
