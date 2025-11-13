import { OrderStatus } from '../entities/order.entity';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetOrderListDto {
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
