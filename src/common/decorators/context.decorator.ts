import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from 'express';

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
