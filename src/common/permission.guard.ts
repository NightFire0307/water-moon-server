import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PermissionGuard implements CanActivate {
  @Inject(Reflector)
  reflector: Reflector;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    if (!request.user) return true;

    // 先获取缓存中的权限
    const permissions = await this.redisClient.get(
      `permissions:${request.user.userId}`,
    );

    // 如果缓存中没有权限，则从数据库中获取，并存入缓存
    if (!permissions) {
      // TODO 从数据库中获取用户权限
      debugger;
    }

    // TODO 比对用户权限和接口权限

    // 获取接口上定义的权限
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'require-permission',
      [context.getClass(), context.getHandler()],
    );

    console.log(requiredPermissions);

    return true;
  }
}
