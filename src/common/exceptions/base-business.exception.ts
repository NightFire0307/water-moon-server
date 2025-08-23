import { HttpException, HttpStatus } from '@nestjs/common';

interface BaseBusinessExceptionOptions {
  msg: string;
  code: string | number;
  data: any;
  status?: HttpStatus;
}

export class BaseBusinessException extends HttpException {
  public readonly code: string | number;
  public readonly msg: string;
  public readonly data: any;

  constructor(options: BaseBusinessExceptionOptions) {
    super(
      {
        code: options.code,
        msg: options.msg,
        data: options.data ?? null,
      },
      options.status || HttpStatus.BAD_REQUEST,
    );

    this.code = options.code;
    this.msg = options.msg;
    this.data = options.data ?? null;
  }
}
