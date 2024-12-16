import { Controller, Get, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Pagination, PaginationQuery, RequireLogin } from '../custom.decorator';

@Controller('admin')
export class AuthController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @RequireLogin()
  async findAllUsers(@Pagination() pagination: PaginationQuery) {
    return await this.adminService.findAllUsers(pagination);
  }

  @Get('users/:id')
  @RequireLogin()
  async findUserById(@Param('id') id: string) {
    return await this.adminService.findUserById(parseInt(id));
  }
}
