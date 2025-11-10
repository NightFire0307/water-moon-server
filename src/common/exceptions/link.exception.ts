import { BaseException } from "./base.exception";

export enum LinkErrorCode {
  LINK_NOT_FOUND = 'Link.NotFound',
  LINK_EXPIRED = 'Link.Expired',
  LINK_PASSWORD_INCORRECT = 'Link.PasswordIncorrect',
}

export const LinkExceptionMessages = {
  [LinkErrorCode.LINK_NOT_FOUND]: '分享链接不存在',
  [LinkErrorCode.LINK_EXPIRED]: '分享链接已过期',
  [LinkErrorCode.LINK_PASSWORD_INCORRECT]: '分享链接密码错误',
}

export class LinkException extends BaseException {
  constructor(code: LinkErrorCode, data: any = null, httpStatus: number = 400) {
    super(code, LinkExceptionMessages[code], data, httpStatus);
  }
}