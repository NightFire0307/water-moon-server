/**
 * 格式化响应拦截器
 * 用于统一格式化响应数据
 * 如果响应数据是字符串，则直接作为 msg 返回
 * 如果响应数据是对象，且包含 msg 和 data 字段，则格式化返回
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Response } from 'express';
import { StatusCode } from '../constants/status-code';

@Injectable()
export class FormatResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response: Response = context.switchToHttp().getResponse();

    const contentType = response.getHeader('Content-Type');
    const isStream =
      contentType?.toString().includes('application/zip') ||
      response
        .getHeader('Content-Disposition')
        ?.toString()
        .includes('attachment');

    // 如果是流式响应（如文件下载），则不进行格式化
    if (isStream) {
      console.log('isStream', isStream);
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {

        // 如果响应数据是字符串，则直接作为 msg 返回
        if (typeof data === 'string') {
          return {
            code: StatusCode.SUCCESS,
            msg: data ?? '请求成功',
            data: null
          }
        }

        // 如果响应数据是对象，且包含 msg 和 data 字段，则格式化返回
        if (data && typeof data === 'object' && 'msg' in data && 'data' in data) {
          return {
            code: StatusCode.SUCCESS,
            ...data
          }
        }

        // 如果响应数据是对象，且包含所有字段，则格式化返回
        if (data && typeof data === 'object' && 'code' in data && 'msg' in data && 'data' in data) {
          return {
            ...data,
          }
        }

        // 默认格式化返回
        return {
          code: StatusCode.SUCCESS,
          msg: '请求成功',
          data: data ?? null,
        }
      }),
    );
  }
}
