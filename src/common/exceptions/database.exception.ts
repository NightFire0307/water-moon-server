import { BaseBusinessException } from './base-business.exception';
import { HttpStatus } from '@nestjs/common';

export enum CommonErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CANNOT_DELETE = 'DATABASE_CANNOT_DELETE',
  NO_PERMISSION = 'NO_PERMISSION',
  DATE_ERROR = 'DATE_ERROR',
  OTHER_ERROR = 'OTHER_ERROR',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
}

export enum OrderErrorCode {
  ORDER_IS_SUBMIT = 'ORDER_IS_SUBMIT',
  ORDER_IS_CANCEL = 'ORDER_IS_CANCEL',
  ORDER_IS_SELECTING = 'ORDER_IS_SELECTING',
  ORDER_NUMBER_ALREADY_EXISTS = 'ORDER_NUMBER_ALREADY_EXISTS', // 订单号已存在
  ORDER_PRODUCT_HAS_PHOTO = 'ORDER_PRODUCT_HAS_PHOTO', // 订单产品已存在照片
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION', // 无效的订单状态转换
  ORDER_ALREADY_FINISHED = 'ORDER_ALREADY_FINISHED', // 订单已完成，不能修改状态
}

export enum LinkErrorCode {
  LINK_ERROR = 'LINK_ERROR',
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
      [OrderErrorCode.ORDER_IS_SELECTING]: {
        data: '订单正在选片中',
        status: HttpStatus.BAD_REQUEST,
      },
      [OrderErrorCode.ORDER_PRODUCT_HAS_PHOTO]: {
        data: '订单产品已存在照片',
        status: HttpStatus.BAD_REQUEST,
      },
      [LinkErrorCode.LINK_ERROR]: {
        data: '链接错误',
        status: HttpStatus.GONE,
      },
      [PhotoErrorCode.PHOTO_UPDATE_FAILED]: {
        data: '照片更新失败',
        status: HttpStatus.BAD_REQUEST,
      },
      [ProductErrorCode.PRODUCT_NAME_ALREADY_EXISTS]: {
        data: '产品名称已存在',
        status: HttpStatus.BAD_REQUEST,
      },
      [CommonErrorCode.DATE_ERROR]: {
        data: '日期错误',
        status: HttpStatus.BAD_REQUEST,
      },
      [CommonErrorCode.OTHER_ERROR]: {
        data: '其他错误',
        status: HttpStatus.BAD_REQUEST,
      },
      [CommonErrorCode.INVALID_PASSWORD]: {
        data: '密码不正确',
        status: HttpStatus.UNAUTHORIZED,
      },
      [OrderErrorCode.INVALID_STATUS_TRANSITION]: {
        data: '无效的订单状态转换',
        status: HttpStatus.BAD_REQUEST,
      },
      [OrderErrorCode.ORDER_ALREADY_FINISHED]: {
        data: '订单已完成，不能修改状态',
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
