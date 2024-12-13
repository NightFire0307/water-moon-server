import { Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('login')
  login() {
    return 'login';
  }

  @Get('init-db')
  async initDb() {
    await this.userService.initDb();
    return 'done';
  }
}
