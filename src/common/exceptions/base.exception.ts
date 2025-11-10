import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiErrorResponse<T = any> {
  code: string
  msg: string
  data?: T
  requestId?: string
}

export class BaseException extends HttpException {
  code: string
  data: any
  httpStatus: HttpStatus

  constructor(code: string, msg: string, data: any = null, httpStatus: HttpStatus = HttpStatus.BAD_REQUEST) {
    const response = {
      code,
      msg,
      data,
    }
    super(response, httpStatus)
    this.code = code
    this.data = data
    this.httpStatus = httpStatus
  }
}