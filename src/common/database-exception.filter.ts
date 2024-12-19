import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

export class DatabaseException {
  message: string;

  constructor(message?: string) {
    this.message = message;
  }
}

@Catch(DatabaseException)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(exception: DatabaseException, host: ArgumentsHost) {
    const response: Response = host.switchToHttp().getResponse();

    response
      .json({
        code: HttpStatus.BAD_REQUEST,
        message: '数据库操作失败',
        data: exception.message || '数据库操作失败',
      })
      .end();
  }
}
