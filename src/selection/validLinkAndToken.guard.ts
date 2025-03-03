import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SelectionService } from './selection.service';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface JwtSelectData {
  orderId: number;
  short_url: string;
}

declare module 'express' {
  interface Request {
    orderInfo: JwtSelectData;
  }
}

@Injectable()
export class ValidLinkAndToken implements CanActivate {
  @Inject(JwtService)
  private readonly jwtService: JwtService;

  @Inject(SelectionService)
  private readonly selectionService: SelectionService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const authorization: string = request.headers['authorization'];
    const { short_url } = request.params;

    if (!authorization) throw new BadRequestException('请先登录');
    const token = authorization.split(' ')[1];

    let data: JwtSelectData;
    try {
      data = this.jwtService.verify<JwtSelectData>(token);
    } catch {
      throw new BadRequestException('无效的令牌');
    }

    request.orderInfo = { ...data };

    const decodedOrderId = this.selectionService.decodeOrderId(short_url);
    if (decodedOrderId !== data.orderId.toString()) {
      throw new BadRequestException('无效的短链');
    }

    return true;
  }
}
