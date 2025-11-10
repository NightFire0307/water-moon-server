import { BaseException } from "./base.exception";

export enum PackageErrorCode {
  PACKAGE_NAME_ALREADY_EXISTS = 'Package.NameAlreadyExists',
  PACKAGE_NOT_FOUND = 'Package.NotFound',
  PACKAGE_UPDATE_FAILED = 'Package.UpdateFailed',
  PACKAGE_CREATION_FAILED = 'Package.CreationFailed',
}

const PackageExceptionMessages = {
  [PackageErrorCode.PACKAGE_NAME_ALREADY_EXISTS]: '套餐名称已存在',
  [PackageErrorCode.PACKAGE_NOT_FOUND]: '套餐不存在',
  [PackageErrorCode.PACKAGE_UPDATE_FAILED]: '套餐更新失败',
  [PackageErrorCode.PACKAGE_CREATION_FAILED]: '套餐创建失败',
}

export class PackageException extends BaseException {
  constructor(code: PackageErrorCode, data: any = null, httpStatus: number = 400) {
    super(code, PackageExceptionMessages[code], data, httpStatus);
  }
}