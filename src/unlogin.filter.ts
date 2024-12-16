import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

export class UnloginException {
  message: string;

  constructor(message?: string) {
    this.message = message;
  }
}

@Catch(UnloginException)
export class UnloginFilter implements ExceptionFilter {
  catch(exception: UnloginException, host: ArgumentsHost) {
    const response: Response = host.switchToHttp().getResponse();

    response
      .json({
        code: HttpStatus.UNAUTHORIZED,
        message: 'Token is Fail',
        data: exception.message || '用户未登录',
      })
      .end();
  }
}
