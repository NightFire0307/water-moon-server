import { BaseException } from "./base.exception";

export enum RedisErrorCode {
  REDIS_CONNECTION_FAILED = 'Redis.ConnectionFailed',
  REDIS_OPERATION_FAILED = 'Redis.OperationFailed',
}

export const RedisExceptionMessages = {
  [RedisErrorCode.REDIS_CONNECTION_FAILED]: 'Redis 连接失败',
  [RedisErrorCode.REDIS_OPERATION_FAILED]: 'Redis 操作失败',
}

export class RedisException extends BaseException {
  constructor(code: RedisErrorCode, data: any = null, httpStatus: number = 500) {
    super(code, RedisExceptionMessages[code], data, httpStatus);
  }
}