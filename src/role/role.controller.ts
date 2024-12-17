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

  @Put(':id/permissions')
  @RequireLogin()
  async updateRolePermissions(
    @Param('id') id: string,
    @Body() updateRolePermissionsDto: UpdateRolePermissionsDto,
  ) {
    return await this.roleService.updateRolePermissions(
      +id,
      updateRolePermissionsDto,
    );
  }

  @Delete(':id')
  @RequireLogin()
  async deleteRole(@Param('id') id: string) {
    return await this.roleService.removeRole(+id);
  }

  @Put(':id')
  @RequireLogin()
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.updateRole(+id, updateRoleDto);
  }
}
