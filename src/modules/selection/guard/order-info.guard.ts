import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "@/modules/order/entities/order.entity";
import type { Repository } from "typeorm";
import { OrderNotFoundException } from "../exceptions/order-not-found.exception";

/**
 * 获取订单信息的守卫
 * 1. 验证订单是否存在
 * 2. 将订单信息附加到请求对象上，供后续中间件或处理器使用
 */
export class OrderInfoGuard implements CanActivate {
  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest()

    const order = await this.orderRepository.findOne({
      where: {
        id: request.tokenPayload.orderId
      }
    })

    if (!order) throw new OrderNotFoundException()

    // 将订单信息附加到请求对象上，供后续中间件或处理器使用
    request.order = order

    return true
  }
}