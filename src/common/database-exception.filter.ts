import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

export class DatabaseException {
  message: QueryFailedError;

  constructor(message: QueryFailedError) {
    this.message = message;
  }
}

@Catch(DatabaseException)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(exception: DatabaseException, host: ArgumentsHost) {
    const response: Response = host.switchToHttp().getResponse();

    // console.error(exception.message);

    response
      .json({
        code: HttpStatus.BAD_REQUEST,
        message: '数据库操作失败',
        data: exception.message.message || '数据库操作失败',
      })
      .end();
  }
}
