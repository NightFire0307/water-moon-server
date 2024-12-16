import { Controller, Get, Post } from '@nestjs/common';
import { RoleService } from './role.service';

@Controller('admin/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async getRoles() {
    return this.roleService.getRoles();
  }

  @Post()
  async createRole() {
    return this.roleService.createRole();
  }
}
