import { IsNotEmpty, IsNumber } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class ResetOrderStatusDto {
  @IsNumber()
  @IsNotEmpty()
  status: OrderStatus;
}
