import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Response } from 'express';

@Injectable()
export class FormatResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response: Response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map(({ data, msg }) => {
        return {
          code: response.statusCode,
          msg: msg || '请求成功',
          data,
        };
      }),
    );
  }
}
