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
import { AuthService } from '../auth/auth.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  @Inject(Reflector)
  reflector: Reflector;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @Inject(AuthService)
  private readonly authService: AuthService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    if (!request.user) return true;

    // 获取接口上定义的权限
    const requiredPermissions = this.reflector.getAllAndOverride<string>(
      'require-permission',
      [context.getClass(), context.getHandler()],
    );

    // 先获取缓存中的权限
    const permissions = await this.redisClient.lrange(
      `permissions:${request.user.userId}`,
      0,
      -1,
    );

    // 如果缓存中没有权限，则从数据库中获取，并存入缓存
    if (permissions.length === 0) {
      const userInfo = await this.userRepository
        .createQueryBuilder('user')
        .where('user.user_id = :userId', { userId: request.user.userId })
        .leftJoinAndSelect('user.roles', 'role')
        .leftJoinAndSelect('role.permissions', 'permission')
        .select([
          'user.user_id',
          'role.role_id',
          'role.name',
          'permission.name',
        ])
        .cache(600)
        .getOne();

      const result = {
        ...userInfo,
        permissions: userInfo.roles.flatMap((role) =>
          role.permissions.map((permission) => permission.name),
        ),
      };

      // 缓存用户权限(24小时)
      const pipeline = this.redisClient.pipeline();
      pipeline.lpush(`permissions:${result.user_id}`, ...result.permissions);
      pipeline.expire(`permissions:${result.user_id}`, 60 * 60 * 24);
      await pipeline.exec();

      // 比对用户权限
      return result.permissions.includes(requiredPermissions);
    }

    return permissions.includes(requiredPermissions);
  }
}
