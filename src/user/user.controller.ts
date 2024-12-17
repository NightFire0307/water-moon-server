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
  RequirePermission,
  UserInfo,
} from '../common/custom.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UserDetailVo } from './vo/user-detail.vo';
import { UpdateUseDto } from './dto/update-use.dto';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('用户管理模块')
@ApiBearerAuth()
@Controller('admin/users')
export class UserController {
  constructor(private readonly adminService: UserService) {}

  @Get()
  @RequireLogin()
  @ApiQuery({
    name: 'username',
    required: false,
    description: '用户名',
  })
  @ApiQuery({
    name: 'nickname',
    required: false,
    description: '昵称',
  })
  @RequirePermission('user_view', '查看用户列表')
  async findAllUsers(
    @Pagination() pagination: PaginationQuery,
    @Query('username') username?: string,
    @Query('nickname') nickname?: string,
  ) {
    return await this.adminService.findAllUsers(username, nickname, pagination);
  }

  @Get('info')
  @RequireLogin()
  @RequirePermission('user_view_detail', '查看用户信息')
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
  @RequirePermission('user_create', '创建用户')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.adminService.createUser(createUserDto);
  }

  @Put(':id')
  @RequireLogin()
  @RequirePermission('user_update', '更新用户信息')
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUseDto,
  ) {
    await this.adminService.updateUser(parseInt(userId), updateUserDto);
    return 'done';
  }

  @Delete(':id')
  @RequireLogin()
  @RequirePermission('user_delete', '删除用户')
  async removeUser(@Param('id') userId: string) {
    return this.adminService.deleteUser(parseInt(userId));
  }

  @Post('update_password')
  @RequireLogin()
  @RequirePermission('user_update', '更新用户密码')
  async updatePassword(
    @UserInfo('userId') userId: number,
    @Body() passwordDto: UpdateUserPasswordDto,
  ) {
    return await this.adminService.updatePassword(userId, passwordDto);
  }
}
