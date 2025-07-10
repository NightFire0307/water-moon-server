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
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto } from './dto/update-role.dto';
import { RequirePermission, RequireLogin } from '@/common/decorators/auth.decorator';
import { UserInfo } from '@/common/decorators/context.decorator';
import { Pagination, type PaginationQuery } from '@/common/decorators/pagination.decorator';

@Controller('admin/roles')
@RequirePermission({
  code: 'role',
  name: '角色管理',
  type: 'group',
  description: '角色管理'
})
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
