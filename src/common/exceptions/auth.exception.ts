import { BaseException } from './base.exception';

export enum AuthErrorCode {
  AUTH_INVALID_TOKEN = 'Auth.InvalidToken', // 无效的token
  AUTH_TOKEN_EXPIRED = 'Auth.TokenExpired', // token过期
  AUTH_NOT_LOGIN = 'Auth.NotLogin', // 未登录
  AUTH_LOGIN_FAILED = 'Auth.LoginFailed', // 用户名或密码错误
}

export const AuthExceptionMessages = {
  [AuthErrorCode.AUTH_INVALID_TOKEN]: '无效的 token',
  [AuthErrorCode.AUTH_TOKEN_EXPIRED]: 'token 已过期',
  [AuthErrorCode.AUTH_NOT_LOGIN]: '未登录',
  [AuthErrorCode.AUTH_LOGIN_FAILED]: '用户名或密码错误',
}

export class AuthException extends BaseException {
  constructor(code: AuthErrorCode, httpStatus: number = 401, data: any = null) {
    super(code, AuthExceptionMessages[code], data, httpStatus);
  }
}