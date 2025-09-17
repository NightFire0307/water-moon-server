import { applyDecorators, UseGuards } from "@nestjs/common";
import { OrderInfoGuard } from "../guard/order-info.guard";
import { OrderExpiredGuard } from "../guard/order-expired.guard";

/**
 * 订单流程守卫装饰器
 * @returns Decorator
 */
export function OrderFlow() {
  return applyDecorators(
    UseGuards(OrderInfoGuard, OrderExpiredGuard)
  )
}