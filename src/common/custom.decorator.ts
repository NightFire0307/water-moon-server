import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const REQUIRE_LOGIN_KEY = 'requireLogin';
export const IS_PUBLIC_KEY = 'isPublic';

// 登录元数据
export const RequireLogin = () => SetMetadata(REQUIRE_LOGIN_KEY, true);

// 白名单装饰器
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * 权限元数据
 * @param name 权限显示名
 * @param code 权限编码
 * @param type 权限类型
 * @param description 权限描述
 * @returns
 */
export interface PermissionMetadata {
  name: string;
  code: string;
  type: 'button' | 'group';
  description?: string;
}
export const RequirePermission = (data: PermissionMetadata) => {
  return applyDecorators(SetMetadata(REQUIRE_PERMISSION_KEY, data));
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
