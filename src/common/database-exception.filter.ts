import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

export enum DatabaseErrorType {
  DATA_ALREADY_EXISTS = 'DATA_ALREADY_EXISTS',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DEFAULT = 'DEFAULT',
}

export class DatabaseException extends Error {
  constructor(
    public type: DatabaseErrorType,
    message: string,
  ) {
    super(message);
    this.name = 'DatabaseException';
  }
}

@Catch(DatabaseException)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(exception: DatabaseException, host: ArgumentsHost) {
    const response: Response = host.switchToHttp().getResponse();

    // console.error(exception);

    switch (exception.type) {
      case DatabaseErrorType.DATA_ALREADY_EXISTS:
        return response.json({
          code: HttpStatus.CONFLICT,
          msg: exception.message,
          data: '数据库操作失败',
        });

      case DatabaseErrorType.DATA_NOT_FOUND:
        return response.json({
          code: HttpStatus.NOT_FOUND,
          msg: exception.message,
          data: '数据库操作失败',
        });

      default:
        return response.json({
          code: HttpStatus.BAD_REQUEST,
          msg: '数据库操作失败',
          data: exception.message || '数据库操作失败',
        });
    }
  }
}
