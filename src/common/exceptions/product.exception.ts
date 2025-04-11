import { BaseBusinessException } from './base-business.exception';
import { HttpStatus } from '@nestjs/common';

export enum ProductErrorCode {
  IS_NOT_EXIST = 'PRODUCT_IS_NOT_EXIST',
}

export class ProductException extends BaseBusinessException {
  constructor(code: ProductErrorCode, detail?: any) {
    const map: Record<ProductErrorCode, { msg: string; status: number }> = {
      [ProductErrorCode.IS_NOT_EXIST]: {
        msg: '商品不存在',
        status: HttpStatus.NOT_FOUND,
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
