import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

export enum RedisErrorType {
  EXPIRE_TIME_ERROR = 'EXPIRE_TIME_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class RedisException extends Error {
  constructor(
    public type: RedisErrorType,
    message: string,
  ) {
    super(message);
    this.name = 'RedisException';
  }
}

@Catch(RedisException)
export class RedisExceptionFilter implements ExceptionFilter {
  catch(exception: RedisException, host: ArgumentsHost) {
    const response: Response = host.switchToHttp().getResponse();

    switch (exception.type) {
      case RedisErrorType.EXPIRE_TIME_ERROR:
        return response.json({
          code: HttpStatus.BAD_REQUEST,
          msg: exception.message,
          data: 'Redis操作失败',
        });
      default:
        return response.json({
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          msg: 'Redis操作失败',
          data: exception.message || 'Redis操作失败',
        });
    }
  }
}
