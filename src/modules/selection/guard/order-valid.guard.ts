import { CommonErrorCode, DatabaseException } from '@/common/exceptions/database.exception';
import { Order } from '@/modules/order/entities/order.entity';
import { CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { OrderExpiredException } from '../exceptions/order-expired.exception';

/**
 * 校验选片订单是否过有效期
 */
export class OrderValidGuard implements CanActivate {

  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>;

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const { orderId } = request.orderInfo;

    const order = await this.orderRepository.findOne({
      where: {
        id: orderId
      }
    })

    if (!order) throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');

    if (new Date() > order.validUntil) {
      throw new OrderExpiredException()
    }

    return true;
  }
}