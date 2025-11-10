import { BaseException } from "./base.exception";

export enum OrderErrorCode {
  ORDER_NOT_FOUND = 'Order.NotFound',
  ORDER_IS_SUBMITTED = 'Order.IsSubmitted',
  ORDER_NOT_SUBMITTED = 'Order.NotSubmitted',
  ORDER_NUMBER_ALREADY_EXISTS = 'Order.NumberAlreadyExists',
  ORDER_EXPIRED = 'Order.Expired',
  ORDER_COMPLETED = 'Order.Completed',
  ORDER_CANCELED = 'Order.Canceled',
  ORDER_STATUS_UPDATE_FAILED = 'Order.StatusUpdateFailed',
}

export const OrderExceptionMessages = {
  [OrderErrorCode.ORDER_NOT_FOUND]: '订单不存在',
  [OrderErrorCode.ORDER_IS_SUBMITTED]: '订单已提交',
  [OrderErrorCode.ORDER_NOT_SUBMITTED]: '订单未提交',
  [OrderErrorCode.ORDER_NUMBER_ALREADY_EXISTS]: '订单号已存在',
  [OrderErrorCode.ORDER_EXPIRED]: '订单已过期',
  [OrderErrorCode.ORDER_COMPLETED]: '订单已完成',
  [OrderErrorCode.ORDER_CANCELED]: '订单已取消',
  [OrderErrorCode.ORDER_STATUS_UPDATE_FAILED]: '订单状态更新失败',
}

export class OrderException extends BaseException {
  constructor(code: OrderErrorCode, data: any = null, httpStatus: number = 400,) {
    super(code, OrderExceptionMessages[code], data, httpStatus);
  }
}