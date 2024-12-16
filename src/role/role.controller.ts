import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { RoleService } from './role.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
} from '../common/custom.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto } from './dto/update-role.dto';

@Controller('admin/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequireLogin()
  async getRoles(@Pagination() pagination: PaginationQuery) {
    return this.roleService.getRoles(pagination);
  }

  @Post()
  @RequireLogin()
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.createRole(createRoleDto);
  }

  @Put('permissions')
  @RequireLogin()
  async updateRolePermissions(
    @Body() updateRolePermissionsDto: UpdateRolePermissionsDto,
  ) {
    await this.roleService.updateRolePermissions(updateRolePermissionsDto);
    return 'done';
  }

  @Put(':id')
  @RequireLogin()
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.updateRole(+id, updateRoleDto);
  }
}
