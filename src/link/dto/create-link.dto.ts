import {
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  IsOptional,
  Length,
} from 'class-validator';

export class CreateLinkDto {
  @IsNotEmpty()
  order_id: number;

  @IsOptional()
  @Length(4, 6)
  password?: string;

  @IsOptional()
  @IsInt({ message: '时间戳必须是整数' })
  @Min(0, { message: '时间戳不能小于 0' }) // Unix 时间戳最小值
  @Max(9999999999, { message: '时间戳格式错误' }) // 防止超过 10 位秒级时间戳
  expired_at: number | null;

  @IsOptional()
  access_limit?: number;
}
