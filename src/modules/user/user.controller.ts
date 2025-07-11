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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UserDetailVo } from './vo/user-detail.vo';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { RequirePermission, RequireLogin } from '@/common/decorators/auth.decorator';
import { UserInfo } from '@/common/decorators/context.decorator';
import { Pagination, PaginationQuery } from '@/common/decorators/pagination.decorator';

@ApiTags('用户管理模块')
@ApiBearerAuth()
@Controller('admin/users')
@RequirePermission({
  code: 'user',
  name: '用户管理',
  type: 'group',
  description: '用户管理'
})
export class UserController {
  constructor(private readonly adminService: UserService) { }

  @Get()
  @RequireLogin()
  @RequirePermission({
    name: '查看用户',
    code: 'user:view',
    type: 'button',
    description: '查看用户',
  })
  @UseInterceptors(ClassSerializerInterceptor)
  async findAllUsers(
    @Pagination() pagination: PaginationQuery,
    @Query('username') username?: string,
    @Query('nickname') nickname?: string,
  ) {
    return await this.adminService.findAllUsers(username, nickname, pagination);
  }

  @Get('/:id')
  @RequireLogin()
  @RequirePermission({
    name: '查看用户',
    code: 'user:view',
    type: 'button',
    description: '查看用户',
  })
  async findCurUserDetail(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      return '参数错误';
    }

    const user = await this.adminService.findUserDetailById(+id);
    return new UserDetailVo(user)
  }

  @Post()
  @RequireLogin()
  @RequirePermission({
    name: '添加用户',
    code: 'user:create',
    type: 'button',
    description: '添加用户',
  })
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.adminService.createUser(createUserDto);
  }

  @Put('/:id')
  @RequireLogin()
  @RequirePermission({
    name: '更新用户',
    code: 'user:update',
    type: 'button',
    description: '更新用户',
  })
  async updateUser(
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return await this.adminService.updateUser(parseInt(userId), dto);
  }

  @Delete('/:id')
  @RequireLogin()
  @RequirePermission({
    name: '删除用户',
    code: 'user:delete',
    type: 'button',
    description: '删除用户',
  })
  async removeUser(@Param('id') userId: string) {
    return this.adminService.deleteUser(parseInt(userId));
  }

  @Put('/:id/roles')
  @RequireLogin()
  @RequirePermission({
    name: '更新用户角色',
    code: 'user-role:update',
    type: 'button',
    description: '更新用户角色',
  })
  async updateUserRoles(
    @Param('id') userId: string,
    @Body('roleIds') roleIds: number[],
  ) {
    return await this.adminService.updateUserRoles(parseInt(userId), roleIds);
  }

  @Post('/update_password')
  @RequireLogin()
  @RequirePermission({
    name: '修改密码',
    code: 'user-pwd:update',
    type: 'button',
    description: '修改用户密码',
  })
  async updatePassword(
    @UserInfo('userId') userId: number,
    @Body() passwordDto: UpdateUserPasswordDto,
  ) {
    return await this.adminService.updatePassword(userId, passwordDto);
  }

  @Post('/reset_password')
  @RequireLogin()
  @RequirePermission({
    name: '重置密码',
    code: 'user-pwd:reset',
    type: 'button',
    description: '重置用户密码',
  })
  async resetPassword(
    @UserInfo('userId') userId: number,
    @UserInfo('isAdmin') isAdmin: boolean,
    @Body() passwordDto: ResetUserPasswordDto,
  ) {
    return await this.adminService.resetPassword(passwordDto, userId, isAdmin);
  }
}
