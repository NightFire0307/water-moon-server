import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
  RequirePermission,
  UserInfo,
} from '../../common/custom.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UserDetailVo } from './vo/user-detail.vo';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

@ApiTags('用户管理模块')
@ApiBearerAuth()
@Controller('admin/users')
export class UserController {
  constructor(private readonly adminService: UserService) { }

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
  @UseInterceptors(ClassSerializerInterceptor)
  async findAllUsers(
    @Pagination() pagination: PaginationQuery,
    @Query('username') username?: string,
    @Query('nickname') nickname?: string,
  ) {
    return await this.adminService.findAllUsers(username, nickname, pagination);
  }

  @Get(':id')
  @RequireLogin()
  @RequirePermission('user_view_detail', '查看用户信息')
  async findCurUserDetail(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      return '参数错误';
    }

    const user = await this.adminService.findUserDetailById(+id);

    if (user) {
      const vo = new UserDetailVo();
      vo.id = user.user_id;
      vo.username = user.username;
      vo.nickname = user.nickname;
      vo.isFrozen = user.isFrozen;
      vo.isAdmin = user.isAdmin;
      vo.updateTime = user.updateTime;
      vo.createTime = user.createTime;
      return vo;
    } else {
      return '用户不存在';
    }
  }

  @Post()
  @RequireLogin()
  @RequirePermission('user_create', '创建用户')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.adminService.createUser(createUserDto);
  }

  @Put('/:id')
  @RequireLogin()
  @RequirePermission('user_update', '更新用户')
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.adminService.updateUser(parseInt(userId), updateUserDto);
  }

  @Delete('/:id')
  @RequireLogin()
  @RequirePermission('user_delete', '删除用户')
  async removeUser(@Param('id') userId: string) {
    return this.adminService.deleteUser(parseInt(userId));
  }

  @Put('/:id/roles')
  @RequireLogin()
  @RequirePermission('user_update_role', '更新用户角色')
  async updateUserRoles(
    @Param('id') userId: string,
    @Body('roleIds') roleIds: number[],
  ) {
    return await this.adminService.updateUserRoles(parseInt(userId), roleIds);
  }

  @Post('update_password')
  @RequireLogin()
  @RequirePermission('user_update_pwd', '更新用户密码')
  async updatePassword(
    @UserInfo('userId') userId: number,
    @Body() passwordDto: UpdateUserPasswordDto,
  ) {
    return await this.adminService.updatePassword(userId, passwordDto);
  }

  @Post('reset_password')
  @RequireLogin()
  @RequirePermission('user_reset_pwd', '重置用户密码')
  async resetPassword(
    @UserInfo('userId') userId: number,
    @UserInfo('isAdmin') isAdmin: boolean,
    @Body() passwordDto: ResetUserPasswordDto,
  ) {
    return await this.adminService.resetPassword(passwordDto, userId, isAdmin);
  }
}
