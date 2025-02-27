import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';

export const PERMISSION_KEY = 'require-permission';

export const RequireLogin = () => SetMetadata('require-login', true);
export const RequirePermission = (
  permissions: string,
  description?: string,
) => {
  return applyDecorators(
    SetMetadata(PERMISSION_KEY, permissions),
    SetMetadata('description', description ?? ''),
  );
};

// 从Token中获取用户信息
export const UserInfo = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();

    if (!request.user) return null;

    return data ? request.user[data] : request.user;
  },
);

// 从Token中获取选片订单信息
export const OrderInfo = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();

    if (!request.orderInfo) return null;

    return data ? request.orderInfo[data] : request.orderInfo;
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
