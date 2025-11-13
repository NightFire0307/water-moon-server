import { BaseException } from "./base.exception";

export enum UserErrorCode {
  USER_NOT_FOUND = 'User.NotFound',
  USER_CREATION_FAILED = 'User.CreationFailed',
  USER_UPDATE_FAILED = 'User.UpdateFailed',
  USER_DELETE_FAILED = 'User.DeleteFailed',
  USER_PASSWORD_RESET_FAILED = 'User.PasswordResetFailed',
}

export const UserExceptionMessages = {
  [UserErrorCode.USER_NOT_FOUND]: '用户不存在',
  [UserErrorCode.USER_CREATION_FAILED]: '用户创建失败',
  [UserErrorCode.USER_UPDATE_FAILED]: '用户更新失败',
  [UserErrorCode.USER_DELETE_FAILED]: '用户删除失败',
  [UserErrorCode.USER_PASSWORD_RESET_FAILED]: '用户密码重置失败',
}

export class UserException extends BaseException {
  constructor(code: UserErrorCode, data: any = null, httpStatus: number = 400) {
    super(code, UserExceptionMessages[code], data, httpStatus);
  }
}