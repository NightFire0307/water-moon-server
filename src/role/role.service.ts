import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '../auth/entities/role.entity';
import { In, Repository } from 'typeorm';
import { PaginationQuery } from '../common/custom.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto } from './dto/update-role.dto';
import { Permission } from '../auth/entities/permissions.entity';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';
import { Redis } from 'ioredis';

@Injectable()
export class RoleService {
  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private readonly permissionRepository: Repository<Permission>;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

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

  async updateRole(id: number, updateRoleDto: UpdateRoleDto) {
    const role = await this.roleRepository.preload({
      role_id: id,
      ...updateRoleDto,
    });

    if (!role) return '角色不存在';

    await this.roleRepository.save(role);
    return '更新成功';
  }

  async removeRole(id: number) {
    const role = await this.roleRepository.findOne({
      where: {
        role_id: id,
      },
    });

    if (!role) return '删除失败！角色不存在';
    await this.roleRepository.remove(role);
    return '删除成功';
  }

  async updateRolePermissions(
    id: number,
    updateRolePermissionsDto: UpdateRolePermissionsDto,
    userId: number,
  ) {
    const { permissionsIds } = updateRolePermissionsDto;
    const role_permissions = await this.roleRepository.findOne({
      where: {
        role_id: id,
      },
      relations: {
        permissions: true,
      },
    });

    if (!role_permissions)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '角色不存在',
      );

    role_permissions.permissions = await this.permissionRepository.find({
      where: {
        id: In(permissionsIds),
      },
    });

    const saveResult = await this.roleRepository.save(role_permissions);
    const permissions = saveResult.permissions.map(
      (permission) => permission.name,
    );

    // 更新Redis缓存
    const pipeline = this.redisClient.pipeline();
    pipeline.del(`permissions:${userId}`);
    pipeline.lpush(`permissions:${userId}`, ...permissions);
    pipeline.expire(`permissions:${userId}`, 60 * 60 * 24);
    await pipeline.exec();

    return 'done';
  }
}
