import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';

export interface PaginationOptions {
  defaultCurrent?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
  minPageSize?: number;
}

export interface PaginationQuery {
  current: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * 分页装饰器
 * 用于从请求的查询参数中提取分页信息
 * @returns {PaginationQuery} 包含当前页码和每页大小的对象
 */
export const Pagination = createParamDecorator(
  (options: PaginationOptions = {}, ctx: ExecutionContext): PaginationQuery => {
    const request: Request = ctx.switchToHttp().getRequest();
    const query = request.query;

    // 默认分页配置
    const {
      defaultCurrent = 1,
      defaultPageSize = 10,
      maxPageSize = 100,
      minPageSize = 1,
    } = options

    // 解析 Current 
    let current = defaultCurrent;
    if (query.current) {
      const parseCurrent = parseInt(query.current as string, 10) || 1;
      if (isNaN(parseCurrent) || parseCurrent < 1) {
        throw new BadRequestException('current 必须是一个大于等于 0 的整数');
      }
      current = parseCurrent;
    }

    // 解析 PageSize
    let pageSize = defaultPageSize;
    if (query.pageSize) {
      const parsePageSize = parseInt(query.pageSize as string, 10) || 10;
      if (isNaN(parsePageSize)) {
        throw new BadRequestException('pageSize 必须是一个有效的数字');
      }

      if (parsePageSize < minPageSize || parsePageSize > maxPageSize) {
        throw new BadRequestException(
          `pageSize 必须在 ${minPageSize} 和 ${maxPageSize} 之间`,
        );
      }
      pageSize = parsePageSize
    }

    // 计算查询数据库所需的 skip 和 take
    const skip = (current - 1) * pageSize;
    const take = pageSize;

    return {
      pageSize,
      current,
      skip,
      take,
    };
  },
);
