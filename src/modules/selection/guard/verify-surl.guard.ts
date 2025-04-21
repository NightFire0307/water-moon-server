import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { SelectionService } from '../selection.service';

@Injectable()
export class VerifySurl implements CanActivate {
  @Inject(SelectionService)
  private readonly selectionService: SelectionService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const { short_url } = request.params;
    const { orderId } = request.orderInfo;

    if (!short_url) {
      throw new BadRequestException('无效链接');
    }

    const decodedOrderId = this.selectionService.decodeOrderId(short_url);

    if (orderId !== +decodedOrderId) {
      throw new NotFoundException('未找到订单');
    }

    return true;
  }
}
