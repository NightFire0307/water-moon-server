import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
  UserInfo,
} from '../common/custom.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UserDetailVo } from './vo/user-detail.vo';
import { UpdateUseDto } from './dto/update-use.dto';

@Controller('admin/users')
export class UserController {
  constructor(private readonly adminService: UserService) { }

  @Get()
  @RequireLogin()
  async findAllUsers(
    @Query('username') username: string,
    @Query('nickname') nickname: string,
    @Pagination() pagination: PaginationQuery,
  ) {
    return await this.adminService.findAllUsers(username, nickname, pagination);
  }

  @Get('info')
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

  @Post()
  @RequireLogin()
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.adminService.createUser(createUserDto);
  }

  @Put(':id')
  @RequireLogin()
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUseDto,
  ) {
    await this.adminService.updateUser(parseInt(userId), updateUserDto);
    return 'done';
  }

  @Delete(':id')
  @RequireLogin()
  async removeUser(@Param('id') userId: string) {
    return this.adminService.deleteUser(parseInt(userId));
  }

  @Post('update_password')
  @RequireLogin()
  async updatePassword(
    @UserInfo('userId') userId: number,
    @Body() passwordDto: UpdateUserPasswordDto,
  ) {
    return await this.adminService.updatePassword(userId, passwordDto);
  }
}
