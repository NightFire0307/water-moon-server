import { BaseBusinessException } from './base-business.exception';
import { HttpStatus } from '@nestjs/common';

export enum AuthErrorCode {
  NOT_LOGIN = 'AUTH_NOT_LOGIN',
  LOGIN_EXPIRED = 'AUTH_LOGIN_EXPIRED',
  PASSWORD_ERROR = 'AUTH_PASSWORD_ERROR',
}

export class AuthException extends BaseBusinessException {
  constructor(code: AuthErrorCode, detail?: any) {
    const map: Record<AuthErrorCode, { msg: string; status: number }> = {
      [AuthErrorCode.NOT_LOGIN]: {
        msg: '用户未登录',
        status: HttpStatus.UNAUTHORIZED,
      },
      [AuthErrorCode.LOGIN_EXPIRED]: {
        msg: '登录已过期',
        status: HttpStatus.UNAUTHORIZED,
      },
      [AuthErrorCode.PASSWORD_ERROR]: {
        msg: '密码错误',
        status: HttpStatus.UNAUTHORIZED,
      },
    };

    const { msg, status } = map[code];
    super({
      msg,
      code,
      data: detail ?? null,
      status,
    });
  }
}
