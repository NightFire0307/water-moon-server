import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';
import { PaginationQuery } from '../custom.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
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

  createUser(createUserDto: CreateUserDto) {
    console.log(createUserDto);
    return 'done';
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
