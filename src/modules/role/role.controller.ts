import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  SetMetadata,
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
@SetMetadata('permission', { name: '角色管理', code: 'role', type: 'group' })
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Get()
  @RequireLogin()
  @RequirePermission({
    name: '查看角色',
    code: 'role:view',
    type: 'button',
    description: '查看角色',
  })
  async getRoles(@Pagination() pagination: PaginationQuery) {
    return this.roleService.getRoles(pagination);
  }

  @Post()
  @RequireLogin()
  @RequirePermission({
    name: '创建角色',
    code: 'role:create',
    type: 'button',
    description: '创建角色',
  })
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.createRole(createRoleDto);
  }

  @Put('/:roleId/permissions')
  @RequireLogin()
  @RequirePermission({
    name: '修改角色权限',
    code: 'role:update',
    type: 'button',
    description: '修改角色权限',
  })
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
  @RequirePermission({
    name: '删除角色',
    code: 'role:delete',
    type: 'button',
    description: '删除角色',
  })
  async deleteRole(@Param('id') id: string) {
    return await this.roleService.removeRole(+id);
  }

  @Put('/:id')
  @RequireLogin()
  @RequirePermission({
    name: '更新角色',
    code: 'role:update',
    type: 'button',
    description: '更新角色',
  })
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.updateRole(+id, updateRoleDto);
  }

  @Get('/:roleId')
  @RequireLogin()
  getRoleByRoleId(@Param('roleId') roleId: string) {
    return this.roleService.getRoleByRoleId(+roleId);
  }
}
