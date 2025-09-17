import { StatusCode } from "@/common/constants/status-code";
import { BaseBusinessException } from "@/common/exceptions/base-business.exception";

export class OrderExpiredException extends BaseBusinessException {
  constructor() {
    super({
      code: StatusCode.ORDER_IS_EXPIRED,
      data: null,
      msg: '选片订单已过期，请联系选片师',
      status: 200,
    })
  }
}