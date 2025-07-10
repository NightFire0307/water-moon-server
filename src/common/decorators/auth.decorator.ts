import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const REQUIRE_LOGIN_KEY = 'requireLogin';
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 登录装饰器 - 标记需要登录的接口
 */
export const RequireLogin = () => SetMetadata(REQUIRE_LOGIN_KEY, true);

/**
 * 公开接口装饰器 - 标记不需要认证的接口
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * 权限装饰器 - 标记需要特定权限的接口
 * @param data 权限元数据
 * @returns 
 */
export interface PermissionMetadata {
  name: string;
  code: string;
  type: 'button' | 'group';
  description?: string;
}
export const RequirePermission = (data: PermissionMetadata) => SetMetadata(REQUIRE_PERMISSION_KEY, data);