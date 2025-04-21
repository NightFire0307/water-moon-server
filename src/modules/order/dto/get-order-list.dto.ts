import { OrderStatus } from '../entities/order.entity';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetOrderListDto {
  @IsOptional()
  @IsString()
  order_number?: string;

  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
