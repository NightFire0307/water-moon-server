import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Redis } from 'ioredis';
import { Permission } from '../auth/entities/permissions.entity';

@Injectable()
export class PermissionGuard implements CanActivate {
  @Inject(Reflector)
  reflector: Reflector;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    if (!request.user) return true;

    // 获取缓存中的权限
    const permissions = await this.redisClient.get(
      `permissions:${request.user.userId}`,
    );

    // TODO 从数据库中获取用户权限

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'require-permission',
      [context.getClass(), context.getHandler()],
    );

    if (!requiredPermissions) return true;

    const userPermissions: Permission[] = JSON.parse(permissions);
    const hasPermission = requiredPermissions.every((requiredPermission) =>
      userPermissions.some(
        (item: Permission) => item.name === requiredPermission,
      ),
    );

    if (!hasPermission) {
      throw new UnauthorizedException('您没有访问该接口的权限');
    }
    return true;
  }
}
