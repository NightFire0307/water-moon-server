import { BaseBusinessException } from './base-business.exception';
import { HttpStatus } from '@nestjs/common';

export enum CommonErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CANNOT_DELETE = 'DATABASE_CANNOT_DELETE',
  NO_PERMISSION = 'NO_PERMISSION',
}

export enum OrderErrorCode {
  ORDER_IS_SUBMIT = 'ORDER_IS_SUBMIT',
  ORDER_IS_CANCEL = 'ORDER_IS_CANCEL',
  ORDER_NUMBER_ALREADY_EXISTS = 'ORDER_NUMBER_ALREADY_EXISTS',
}

export enum LinkErrorCode {
  LINK_EXPIRED = 'LINK_EXPIRED',
}

export enum PhotoErrorCode {
  PHOTO_UPDATE_FAILED = 'PHOTO_UPDATE_FAILED',
}

export enum ProductErrorCode {
  PRODUCT_NAME_ALREADY_EXISTS = 'PRODUCT_NAME_ALREADY_EXISTS',
}

type DataBaseErrorCode =
  | CommonErrorCode
  | OrderErrorCode
  | LinkErrorCode
  | PhotoErrorCode
  | ProductErrorCode;

export class DatabaseException extends BaseBusinessException {
  constructor(code: DataBaseErrorCode, detail?: any) {
    const map: Record<DataBaseErrorCode, { data: string; status: number }> = {
      [CommonErrorCode.NOT_FOUND]: {
        data: '数据不存在',
        status: HttpStatus.NOT_FOUND,
      },
      [CommonErrorCode.DATABASE_ERROR]: {
        data: '数据库操作错误',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      [CommonErrorCode.DATABASE_CANNOT_DELETE]: {
        data: '数据库操作失败',
        status: HttpStatus.BAD_REQUEST,
      },
      [CommonErrorCode.NO_PERMISSION]: {
        data: '无权限操作',
        status: HttpStatus.FORBIDDEN,
      },
      [OrderErrorCode.ORDER_NUMBER_ALREADY_EXISTS]: {
        data: '订单号已存在',
        status: HttpStatus.BAD_REQUEST,
      },
      [OrderErrorCode.ORDER_IS_SUBMIT]: {
        data: '订单已提交',
        status: HttpStatus.BAD_REQUEST,
      },
      [OrderErrorCode.ORDER_IS_CANCEL]: {
        data: '订单已取消',
        status: HttpStatus.BAD_REQUEST,
      },
      [LinkErrorCode.LINK_EXPIRED]: {
        data: '链接已过期',
        status: HttpStatus.BAD_REQUEST,
      },
      [PhotoErrorCode.PHOTO_UPDATE_FAILED]: {
        data: '照片更新失败',
        status: HttpStatus.BAD_REQUEST,
      },
      [ProductErrorCode.PRODUCT_NAME_ALREADY_EXISTS]: {
        data: '产品名称已存在',
        status: HttpStatus.BAD_REQUEST,
      },
    };

    const { data, status } = map[code];
    super({
      msg: detail ?? null,
      code,
      data,
      status,
    });
  }
}
