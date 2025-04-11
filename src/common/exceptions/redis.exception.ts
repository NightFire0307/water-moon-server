import { BaseBusinessException } from './base-business.exception';
import { HttpStatus } from '@nestjs/common';

export enum RedisErrorType {
  UNKNOWN = 'unknown',
}

export class RedisException extends BaseBusinessException {
  constructor(code: RedisErrorType, detail?: any) {
    const map: Record<RedisErrorType, { msg: string; status: number }> = {
      [RedisErrorType.UNKNOWN]: {
        msg: '未知错误',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
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
