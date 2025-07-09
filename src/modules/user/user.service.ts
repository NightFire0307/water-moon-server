import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { In, Like, Repository } from 'typeorm';
import { PaginationQuery } from '../../common/custom.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../role/entities/role.entity';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import {
  CommonErrorCode,
  DatabaseException,
} from '../../common/exceptions/database.exception';

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

    return {
      data: {
        list: data,
        current,
        pageSize,
        total,
      },
    };
  }

  async findUserDetailById(userId: number) {
    return await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
      relations: ['roles'],
    });
  }

  async createUser(createUserDto: CreateUserDto) {
    const { password, roles, ...rest } = createUserDto;
    const saltRound = this.configService.get('hash_salt_rounds');
    const hashedPassword = await hash(password, parseInt(saltRound));

    // 先查询 Role 实体
    const roleEntities = await this.roleRepository.findBy({
      roleId: In(roles),
    });

    console.log(roleEntities);

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

      dataToUpdate.roles = roles;
    }

    const user = await this.userRepository.preload({
      user_id: userId,
      ...dataToUpdate,
    });

    if (!user) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '未查询到该用户');
    }

    await this.userRepository.save(user);

    return {
      data: userId,
      msg: '更新成功',
    };
  }

  async deleteUser(userId: number) {
    const foundUser = await this.userRepository.findOneBy({ user_id: userId });

    if (!foundUser) return '未查询到用户';
    if (!foundUser.isDelete) {
      foundUser.isDelete = true;
      await this.userRepository.save(foundUser);
    }

    return '删除成功';
  }

  async updatePassword(userId: number, passwordDto: UpdateUserPasswordDto) {
    const foundUser = await this.userRepository.findOneBy({ user_id: userId });
    const saltRounds: string = this.configService.get('hash_salt_rounds');

    foundUser.password = await hash(passwordDto.password, parseInt(saltRounds));

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

    foundUser.roles = roles;
    await this.userRepository.save(foundUser);

    return '角色更新成功';
  }

  async resetPassword(
    resetPasswordDto: ResetUserPasswordDto,
    curUserId: number,
    isAdmin: boolean,
  ) {
    const { userId, password } = resetPasswordDto;
    if (userId !== curUserId && !isAdmin)
      throw new DatabaseException(CommonErrorCode.NO_PERMISSION);

    const foundUser = await this.userRepository.findOneBy({ user_id: userId });
    const saltRounds: string = this.configService.get('hash_salt_rounds');
    foundUser.password = await hash(password, parseInt(saltRounds));

    try {
      await this.userRepository.save(foundUser);
      return { data: foundUser.user_id, msg: '密码重置成功' };
    } catch {
      return { data: foundUser.user_id, msg: '密码重置失败' };
    }
  }
}
