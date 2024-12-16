import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';

export const RequireLogin = () => SetMetadata('require-login', true);
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata('require-permission', permissions);

export const UserInfo = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();

    if (!request.user) return null;

    return data ? request.user[data] : request.user;
  },
);

export interface PaginationQuery {
  current: number;
  pageSize: number;
}

// 分页装饰器
export const Pagination = createParamDecorator(
  (data: string, ctx: ExecutionContext): PaginationQuery => {
    const request: Request = ctx.switchToHttp().getRequest();
    const query = request.query;

    const current = parseInt(query.current as string, 10) || 1;
    const pageSize = parseInt(query.pageSize as string, 10) || 10;

    return {
      pageSize,
      current,
    };
  },
);
