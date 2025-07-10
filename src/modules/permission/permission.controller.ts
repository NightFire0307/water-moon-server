import { Controller, Get } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { RequireLogin } from '@/common/decorators/auth.decorator';
import { Pagination, type PaginationQuery } from '@/common/decorators/pagination.decorator';

@Controller('admin/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) { }

  @Get()
  @RequireLogin()
  getPermissions(@Pagination() pagination: PaginationQuery) {
    return this.permissionService.getPermissions(pagination);
  }
}
