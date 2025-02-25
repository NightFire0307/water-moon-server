import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

export enum OperatorErrorType {
  NO_PERMISSION = 'NO_PERMISSION',
}

export class OperatorException extends Error {
  constructor(
    public type: OperatorErrorType,
    message: string,
  ) {
    super(message);
    this.name = 'OperatorException';
  }
}

@Catch(OperatorException)
export class OperatorExceptionFilter implements ExceptionFilter {
  catch(exception: OperatorException, host: ArgumentsHost) {
    console.error(exception);
    const response: Response = host.switchToHttp().getResponse();

    switch (exception.type) {
      case OperatorErrorType.NO_PERMISSION:
        return response.json({
          code: HttpStatus.FORBIDDEN,
          msg: exception.message,
          data: '操作失败',
        });
      default:
        return response.json({
          code: HttpStatus.BAD_REQUEST,
          data: exception.message || '操作失败',
          msg: '操作失败',
        });
    }
  }
}
