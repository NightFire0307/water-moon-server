import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';
import { PaginationQuery } from '../custom.decorator';

@Injectable()
export class AdminService {
  @InjectRepository(User)
  private userRepository: Repository<User>;

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
}
