import { Body, Controller, Get, Post } from '@nestjs/common';
import { RoleService } from './role.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
} from '../common/custom.decorator';
import { CreateRoleDto } from './dto/create-role.dto';

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
}
