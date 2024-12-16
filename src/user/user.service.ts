import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';
import { PaginationQuery } from '../common/custom.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UpdateUseDto } from './dto/update-use.dto';

@Injectable()
export class UserService {
  @InjectRepository(User)
  private userRepository: Repository<User>;

  @Inject(ConfigService)
  private configService: ConfigService;

  async findAllUsers(pagination: PaginationQuery) {
    const { current, pageSize } = pagination;
    const [data, total] = await this.userRepository.findAndCount({
      skip: (current - 1) * pageSize,
      take: pageSize,
    });

    return {
      data,
      current,
      pageSize,
      total,
    };
  }

  async findUserDetailById(userId: number) {
    return await this.userRepository.findOneBy({ id: userId });
  }

  async createUser(createUserDto: CreateUserDto) {
    try {
      await this.userRepository.save(createUserDto);
      return '创建成功';
    } catch {
      return '创建失败';
    }
  }

  async updateUser(userId: number, updateUserDto: UpdateUseDto) {
    const result = await this.userRepository.update(userId, updateUserDto);
    if (result.affected === 0) return '未查询到该用户';
    return '更新成功';
  }

  async deleteUser(userId: number) {
    const foundUser = await this.userRepository.findOneBy({ id: userId });

    if (!foundUser) return '未查询到用户';
    if (!foundUser.isDelete) {
      foundUser.isDelete = true;
      await this.userRepository.save(foundUser);
    }

    return '删除成功';
  }

  async updatePassword(userId: number, passwordDto: UpdateUserPasswordDto) {
    const foundUser = await this.userRepository.findOneBy({ id: userId });
    const saltRounds: string = this.configService.get('hash_salt_rounds');

    foundUser.password = await hash(passwordDto.password, parseInt(saltRounds));

    try {
      await this.userRepository.save(foundUser);
      return '密码修改成功';
    } catch {
      return '密码修改失败';
    }
  }
}
