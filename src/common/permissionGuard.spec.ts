import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionGuard();
    guard.reflector = reflector; // 手动注入 Reflector
  });

  it('应允许访问，如果请求中没有用户信息', () => {
    const context = createMockExecutionContext({});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('应允许访问，如果没有定义权限要求', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockExecutionContext({
      user: { permissions: [{ code: 'READ' }] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('应允许访问，如果用户具有所需权限', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['READ']);

    const context = createMockExecutionContext({
      user: { permissions: [{ code: 'READ' }, { code: 'WRITE' }] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('应拒绝访问，如果用户缺少必要权限', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

    const context = createMockExecutionContext({
      user: { permissions: [{ code: 'READ' }] },
    });

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('您没有访问该接口的权限'),
    );
  });
});

// 模拟 ExecutionContext 的辅助函数
function createMockExecutionContext(requestData: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => requestData,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}
