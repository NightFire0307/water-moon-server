import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Pagination, PaginationQuery, RequireLogin } from '../custom.decorator';

@Controller('admin')
export class AuthController {
  constructor(private readonly authService: AdminService) {}

  @Get('users')
  @RequireLogin()
  async findAllUsers(@Pagination() pagination: PaginationQuery) {
    return await this.authService.findAllUsers(pagination);
  }
}
