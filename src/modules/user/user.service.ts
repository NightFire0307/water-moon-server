import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { In, Like, Repository } from 'typeorm';
import { PaginationQuery } from '@/common/decorators/pagination.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { hash, compare } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../role/entities/role.entity';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import {
  CommonErrorCode,
  DatabaseException,
} from '@/common/exceptions/database.exception';

@Injectable()
export class UserService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

  @Inject(ConfigService)
  private readonly configService: ConfigService;

  async findAllUsers(
    username: string,
    nickname: string,
    pagination: PaginationQuery,
  ) {
    const { current, pageSize } = pagination;
    const condition: Record<string, any> = {};

    if (username) condition.username = Like(`%${username}%`);
    if (nickname) condition.nickname = Like(`%${nickname}%`);
    condition.isDelete = false;
    const [data, total] = await this.userRepository.findAndCount({
      skip: (current - 1) * pageSize,
      take: pageSize,
      where: condition,
      relations: ['roles'],
    });

    // 过滤掉超级管理员
    const filterData = data.filter(user => user.roles.some(role => role.code !== 'super_admin'));

    return {
      list: filterData,
      current,
      pageSize,
      total,
    }
  }

  async findUserDetailById(userId: number) {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
      relations: ['roles'],
    });

    if (!user) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '用户不存在');
    }

    return user
  }

  async createUser(createUserDto: CreateUserDto) {
    const { password, roles, ...rest } = createUserDto;
    const saltRound = this.configService.get('hash_salt_rounds');
    const hashedPassword = await hash(password, parseInt(saltRound));

    // 先查询 Role 实体
    const roleEntities = await this.roleRepository.findBy({
      roleId: In(roles),
    });

    // 如果有超级管理员角色，则拒绝
    if (roleEntities.some(role => role.code === 'super_admin')) {
      throw new DatabaseException(CommonErrorCode.NO_PERMISSION, '不允许创建超级管理员角色');
    }

    try {
      const user = this.userRepository.create({
        ...rest,
        password: hashedPassword,
        roles: roleEntities,
      });
      await this.userRepository.save(user);
      return '创建成功';
    } catch {
      return '创建失败';
    }
  }

  async updateUser(userId: number, dto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['roles'],
    });


    if (!user) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '未查询到该用户');
    }

    // 确保更新的用户是非超级管理员
    if (user.roles.some(role => role.code === 'super_admin')) {
      throw new DatabaseException(CommonErrorCode.NO_PERMISSION, '不允许更新超级管理员角色');
    }

    const dataToUpdate: Partial<User> = {
      ...dto,
      updateTime: new Date(),
    };

    // 更新用户角色
    if (dataToUpdate.roles && dataToUpdate.roles.length > 0) {
      const roles = await this.roleRepository.find({
        where: {
          roleId: In(dataToUpdate.roles),
        },
      });

      if (roles.length !== dataToUpdate.roles.length) {
        throw new DatabaseException(CommonErrorCode.NOT_FOUND, '角色不存在');
      }

      if (roles.some(role => role.code === 'super_admin')) {
        throw new DatabaseException(CommonErrorCode.NO_PERMISSION, '不允许分配超级管理员角色');
      }

      user.roles = roles;
    }

    Object.assign(user, dataToUpdate);

    await this.userRepository.save(user);

    return {
      data: userId,
      msg: '更新成功',
    };
  }

  async deleteUser(userId: number) {
    const foundUser = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['roles'],
    });

    if (!foundUser) return '未查询到用户';
    if (!foundUser.isDelete) {
      foundUser.isDelete = true;
      await this.userRepository.save(foundUser);
    }

    // 确保删除的用户是非超级管理员
    if (foundUser.roles.some(role => role.code === 'super_admin')) {
      throw new DatabaseException(CommonErrorCode.NO_PERMISSION, '不能删除超级管理员');
    }

    return '删除成功';
  }

  // 修改密码
  async changePassword(userId: number, passwordDto: UpdateUserPasswordDto) {
    const foundUser = await this.userRepository.findOneBy({ user_id: userId });
    const saltRounds: string = this.configService.get('hash_salt_rounds');

    // 判断旧密码是否正确
    const isPasswordValid = await compare(passwordDto.oldPassword, foundUser.password);
    if (!isPasswordValid) throw new DatabaseException(CommonErrorCode.INVALID_PASSWORD, '旧密码不正确');

    foundUser.password = await hash(passwordDto.newPassword, parseInt(saltRounds));

    try {
      await this.userRepository.save(foundUser);
      return '密码修改成功';
    } catch {
      return '密码修改失败';
    }
  }

  async updateUserRoles(userId: number, roleIds: number[]) {
    const foundUser = await this.userRepository.findOneBy({ user_id: userId });
    if (!foundUser) return '未查询到用户';

    const roles = await this.roleRepository.find({
      where: {
        roleId: In(roleIds),
      },
    });

    // 如果被更新的角色是超级管理员，则拒绝
    if (roles.some(role => role.code === 'super_admin')) {
      throw new DatabaseException(CommonErrorCode.NO_PERMISSION, '不允许分配超级管理员角色');
    }

    foundUser.roles = roles;
    await this.userRepository.save(foundUser);

    return '角色更新成功';
  }

  async resetPassword(
    dto: ResetUserPasswordDto,
    targetUserId: string,
    operatorId: number,
  ) {
    const { newPassword } = dto;

    const targetUser = await this.userRepository.findOne({
      where: { user_id: Number(targetUserId) },
      relations: ['roles'],
    });

    // 判断当前用户是否有权限修改目标用户密码
    if (targetUser.roles.some(role => role.code === 'super_admin')) {
      throw new DatabaseException(CommonErrorCode.NO_PERMISSION, '不允许重置超级管理员密码');
    }

    // 如果当前登录的用户和被修改密码的用户是同一个用户，则拒绝
    if (targetUser.user_id === operatorId)
      throw new DatabaseException(CommonErrorCode.NO_PERMISSION, '不能重置自己的密码, 请使用修改密码功能');

    const saltRounds: string = this.configService.get('hash_salt_rounds');
    targetUser.password = await hash(newPassword, parseInt(saltRounds));

    try {
      await this.userRepository.save(targetUser);
      return { data: targetUser.user_id, msg: '密码重置成功' };
    } catch {
      return { data: targetUser.user_id, msg: '密码重置失败' };
    }
  }
}
