import { Controller, Get } from '@nestjs/common';
import { PermissionService } from './permission.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
} from '../common/custom.decorator';

@Controller('admin/permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @RequireLogin()
  // @RequirePermission('permission_view', '查看权限列表')
  getPermissions(@Pagination() pagination: PaginationQuery) {
    return this.permissionService.getPermissions(pagination);
  }
}
