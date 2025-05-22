import { Controller, Get } from '@nestjs/common';
import { PermissionService } from './permission.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
} from '../../common/custom.decorator';

@Controller('admin/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) { }

  @Get()
  @RequireLogin()
  getPermissions(@Pagination() pagination: PaginationQuery) {
    return this.permissionService.getPermissions(pagination);
  }
}
