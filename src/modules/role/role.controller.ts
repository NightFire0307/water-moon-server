import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { RoleService } from './role.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
  RequirePermission,
  UserInfo,
} from '../../common/custom.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto } from './dto/update-role.dto';

@Controller('admin/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Get()
  @RequireLogin()
  @RequirePermission('role:list', '获取角色列表')
  async getRoles(@Pagination() pagination: PaginationQuery) {
    return this.roleService.getRoles(pagination);
  }

  @Post()
  @RequireLogin()
  @RequirePermission('role:create', '创建角色')
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.createRole(createRoleDto);
  }

  @Put('/:roleId/permissions')
  @RequireLogin()
  @RequirePermission('role-permission:update', '更新角色权限')
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() updateRolePermissionsDto: UpdateRolePermissionsDto,
    @UserInfo('userId') userId: number,
  ) {
    return await this.roleService.updateRolePermissions(
      +roleId,
      updateRolePermissionsDto,
      userId,
    );
  }

  @Delete('/:id')
  @RequireLogin()
  @RequirePermission('role:delete', '删除角色')
  async deleteRole(@Param('id') id: string) {
    return await this.roleService.removeRole(+id);
  }

  @Put('/:id')
  @RequireLogin()
  @RequirePermission('role:update', '更新角色')
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.updateRole(+id, updateRoleDto);
  }
}
