import { BadRequestException, Catch, ExceptionFilter, type ArgumentsHost } from "@nestjs/common";
import { Response, Request } from 'express'
import { BaseException, type ApiErrorResponse } from "../exceptions/base.exception";

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof BadRequestException) {
      const errorResponse = exception.getResponse() as any

      return response.status(400).json({
        code: 'Common.ValidationFailed',
        msg: '参数验证失败',
        detail: errorResponse.message || null,
        requestId: request.headers['x-request-id'] || null,
      })
    }

    if (exception instanceof BaseException) {
      const errorResponse = exception.getResponse() as ApiErrorResponse
      return response.status(exception.httpStatus).json({
        code: errorResponse.code,
        msg: errorResponse.msg,
        data: errorResponse.data,
        requestId: request.headers['x-request-id'] || null,
      })
    }

    return response.status(500).json({
      code: 'Server.InternalError',
      msg: '服务器内部错误',
      data: null,
      requestId: request.headers['x-request-id'] || null,
    })
  }
}