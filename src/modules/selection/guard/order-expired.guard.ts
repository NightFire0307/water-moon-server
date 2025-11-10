import { Injectable, CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { Request } from 'express';
import dayjs from 'dayjs';
import { OrderErrorCode, OrderException } from '@/common/exceptions/order.exception';

@Injectable()
export class OrderExpiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    const validUntil = request.order.validUntil;

    // 判断订单是否过期
    if (dayjs().isAfter(dayjs(validUntil))) {
      throw new OrderException(OrderErrorCode.ORDER_EXPIRED)
    }

    return true
  }
}