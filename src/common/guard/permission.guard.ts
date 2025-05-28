import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../modules/auth/entities/user.entity';
import { Repository } from 'typeorm';
import { AuthService } from '../../modules/auth/auth.service';

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
    if (!request.user) return true

    // 如果是超级用户则直接放行
    if (request.user.roles.includes('super_admin')) return true

    // 获取接口上定义的权限
    const requiredPermissions = this.reflector.getAllAndOverride<string>(
      'require-permission',
      [context.getClass(), context.getHandler()],
    );

    // 校验访问权限
    if (!request.user.permissions.includes(requiredPermissions)) {
      throw new ForbiddenException('您没有访问该资源的权限')
    }

    return true;
  }
}
