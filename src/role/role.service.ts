import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '../auth/entities/role.entity';
import { Repository } from 'typeorm';
import { PaginationQuery } from '../common/custom.decorator';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RoleService {
  @InjectRepository(Role)
  private roleRepository: Repository<Role>;

  async getRoles(pagination: PaginationQuery) {
    const [data, total] = await this.roleRepository.findAndCount({
      skip: (pagination.current - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });
    return {
      data,
      total,
      pageSize: pagination.pageSize,
      current: pagination.current,
    };
  }

  async createRole(createRoleDto: CreateRoleDto) {
    const foundRole = await this.roleRepository.findOneBy({
      name: createRoleDto.name,
    });

    if (foundRole) return '该角色已存在';

    await this.roleRepository.save(createRoleDto);
    return '创建成功';
  }
}
