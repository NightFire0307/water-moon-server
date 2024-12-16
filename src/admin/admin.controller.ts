import { Body, Controller, Get, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
  UserInfo,
} from '../custom.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UserDetailVo } from './vo/user-detail.vo';

@Controller('admin')
export class AuthController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @RequireLogin()
  async findAllUsers(@Pagination() pagination: PaginationQuery) {
    return await this.adminService.findAllUsers(pagination);
  }

  @Get('users/info')
  @RequireLogin()
  async findUserById(@UserInfo('userId') userId: number) {
    const user = await this.adminService.findUserDetailById(userId);
    const vo = new UserDetailVo();
    vo.id = user.id;
    vo.username = user.username;
    vo.nickname = user.nickname;
    vo.isFrozen = user.isFrozen;
    vo.isAdmin = user.isAdmin;
    vo.updateTime = user.updateTime;
    vo.createTime = user.createTime;

    return vo;
  }

  @Post('users')
  @RequireLogin()
  createUser(@Body() createUserDto: CreateUserDto) {
    console.log(createUserDto);
    return 'done';
  }

  @Post('users/update_password')
  @RequireLogin()
  async updatePassword(
    @UserInfo('userId') userId: number,
    @Body() passwordDto: UpdateUserPasswordDto,
  ) {
    return await this.adminService.updatePassword(userId, passwordDto);
  }
}
