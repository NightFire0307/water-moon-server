import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import {
  AuthErrorCode,
  AuthException,
} from '@/common/exceptions/auth.exception';

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
export class ClientAuthGuard implements CanActivate {
  @Inject(JwtService)
  private readonly jwtService: JwtService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const authorization: string = request.headers['authorization'];

    if (!authorization) throw new UnauthorizedException('请先登录');
    const token = authorization.split(' ')[1];

    try {
      const data = this.jwtService.verify<JwtSelectData>(token);
      request.orderInfo = { ...data };
    } catch {
      throw new AuthException(AuthErrorCode.LOGIN_EXPIRED);
    }

    return true;
  }
}
