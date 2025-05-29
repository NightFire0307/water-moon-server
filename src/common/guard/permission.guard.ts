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
import { IS_PUBLIC_KEY, REQUIRE_PERMISSION_KEY, type PermissionMetadata } from '../custom.decorator';

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

    // 1. 检查是否为公共接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getClass(), context.getHandler()],
    );
    if (isPublic) return true;

    const user = request.user;

    // 2. 检查用户信息
    if (!user) {
      throw new ForbiddenException('用户未登录或Token已过期');
    }

    // 3. 超级管理员直接放行
    if (user.roles?.includes('super_admin')) return true;

    // 4. 获取接口所需权限
    const requiredPermission = this.reflector.getAllAndOverride<PermissionMetadata>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    console.log('requiredPermission', requiredPermission);
    if (!requiredPermission) return true; // 未设置权限要求则放行

    // 5. 校验用户权限
    if (!user.permissions?.includes(requiredPermission.code)) {
      throw new ForbiddenException('您没有访问该资源的权限');
    }

    return true;
  }
}
