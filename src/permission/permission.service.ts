import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission } from '../auth/entities/permissions.entity';
import { Repository } from 'typeorm';
import { PaginationQuery } from '../common/custom.decorator';

@Injectable()
export class PermissionService {
  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  async getPermissions(pagination: PaginationQuery) {
    const [list, total] = await this.permissionRepository.findAndCount({
      skip: (pagination.current - 1) * pagination.pageSize,
      take: pagination.current,
    });
    return {
      list,
      total,
      ...pagination,
    };
  }
}
