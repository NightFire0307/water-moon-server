import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthErrorCode, AuthException } from '../exceptions/auth.exception';
import { REQUIRE_LOGIN_KEY } from '../custom.decorator';

export interface JwtUserData {
  userId: number;
  roles: string[];
  permissions: string[];
}

declare module 'express' {
  interface Request {
    user: JwtUserData;
  }
}

@Injectable()
export class LoginGuard implements CanActivate {
  @Inject()
  private reflector: Reflector;

  @Inject(JwtService)
  private jwtService: JwtService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    const requireLogin = this.reflector.getAllAndOverride(REQUIRE_LOGIN_KEY, [
      context.getClass(),
      context.getHandler(),
    ]);

    if (!requireLogin) return true;

    // 获取请求携带的 Token
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('用户未登录');
    }

    try {
      const token = authorization.split(' ')[1];
      const data = this.jwtService.verify<JwtUserData>(token);
      console.log('11', data);

      request.user = {
        userId: data.userId,
        roles: data.roles,
        permissions: data.permissions,
      };

      return true;
    } catch {
      throw new AuthException(
        AuthErrorCode.LOGIN_EXPIRED,
        'Token 失效，请重新登录',
      );
    }
  }
}
