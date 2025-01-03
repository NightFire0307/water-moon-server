import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

export class DatabaseException {
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}

@Catch(DatabaseException)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(exception: DatabaseException, host: ArgumentsHost) {
    const response: Response = host.switchToHttp().getResponse();

    // console.error(exception.message);

    switch (exception.message) {
      case '数据已存在':
        return response.json({
          code: HttpStatus.CONFLICT,
          msg: exception.message,
          data: '',
        });

      case '数据不存在':
        return response.json({
          code: HttpStatus.NOT_FOUND,
          msg: exception.message,
          data: '',
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
