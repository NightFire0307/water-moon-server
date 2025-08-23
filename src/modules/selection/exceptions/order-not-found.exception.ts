import { StatusCode } from "@/common/constants/status-code";
import { BaseBusinessException } from "@/common/exceptions/base-business.exception";

export class OrderNotFoundException extends BaseBusinessException {
  constructor() {
    super({
      code: StatusCode.ORDER_NOT_FOUND,
      data: null,
      msg: '订单不存在'
    })
  }
}