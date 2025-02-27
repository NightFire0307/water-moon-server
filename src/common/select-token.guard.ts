import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

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
export class SelectTokenGuard implements CanActivate {
  @Inject(JwtService)
  private jwtService: JwtService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization) throw new BadRequestException('用户未登录');

    try {
      const token = authorization.split(' ')[1];
      const data = this.jwtService.verify<JwtSelectData>(token);

      request.orderInfo = { ...data };
      return true;
    } catch {
      throw new UnauthorizedException('Token 失效，请重新登录');
    }
  }
}
