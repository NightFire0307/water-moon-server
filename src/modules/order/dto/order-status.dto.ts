import { OrderStatus } from "@/modules/order/entities/order.entity";
import { IsEnum, IsNotEmpty } from "class-validator";

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus
}