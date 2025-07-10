import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { In, Repository } from 'typeorm';
import { PaginationQuery } from '@/common/decorators/pagination.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto } from './dto/update-role.dto';
import { Permission } from '../auth/entities/permissions.entity';
import { Redis } from 'ioredis';
import {
  CommonErrorCode,
  DatabaseException,
} from '../../common/exceptions/database.exception';

@Injectable()
export class RoleService {
  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private readonly permissionRepository: Repository<Permission>;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  async getRoles(pagination: PaginationQuery) {
    const [list, total] = await this.roleRepository.findAndCount({
      skip: (pagination.current - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });
    return {
      data: {
        list,
        total,
        pageSize: pagination.pageSize,
        current: pagination.current,
      },
    };
  }

  async createRole({ code, name, description = '', permissionIds }: CreateRoleDto) {
    const foundRole = await this.roleRepository.findOneBy({
      code,
    });

    if (foundRole) return '该角色已存在';

    const role = this.roleRepository.create({
      code,
      name,
      description,
    });

    const newRole = await this.roleRepository.save(role);

    // 如果同时有权限ID，则添加权限
    if (permissionIds.length > 0) {
      const permissions = await this.permissionRepository.find({
        where: {
          id: In(permissionIds),
        },
      });

      role.permissions = permissions;
      await this.roleRepository.save(role);
    }

    return {
      data: newRole.roleId,
      msg: '创建成功',
    };
  }

  async updateRole(id: number, dto: UpdateRoleDto) {
    const dataToUpdate: Partial<Role> = {
      ...dto,
      updateTime: new Date(),
    };

    // 如果有权限ID，则更新权限
    if (dto.permissionIds.length > 0) {
      const permissions = await this.permissionRepository.find({
        where: {
          id: In(dto.permissionIds),
        },
      });

      dataToUpdate.permissions = permissions;
    }

    const role = await this.roleRepository.preload({
      roleId: id,
      ...dataToUpdate,
    });

    if (!role) return '角色不存在';

    await this.roleRepository.save(role);
    return {
      data: role.roleId,
      msg: '更新成功',
    };
  }

  async removeRole(id: number) {
    const role = await this.roleRepository.findOne({
      where: {
        roleId: id,
      },
    });

    // 禁止删除超级管理员角色
    if (role.code === 'super_admin') {
      throw new DatabaseException(CommonErrorCode.DATABASE_ERROR, '禁止删除超级管理员角色');
    }

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
        roleId: id,
      },
      relations: {
        permissions: true,
      },
    });

    if (!role_permissions)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '角色不存在');

    role_permissions.permissions = await this.permissionRepository.find({
      where: {
        id: In(permissionsIds),
      },
    });

    const saveResult = await this.roleRepository.save(role_permissions);
    const permissions = saveResult.permissions.map(
      (permission) => permission.code,
    );

    // 更新Redis缓存
    const pipeline = this.redisClient.pipeline();
    pipeline.del(`permissions:${userId}`);
    pipeline.lpush(`permissions:${userId}`, ...permissions);
    pipeline.expire(`permissions:${userId}`, 60 * 60 * 24);
    await pipeline.exec();

    return {
      data: '更新成功',
    };
  }

  async getRoleByRoleId(roleId: number) {
    const { permissions, ...rest } = await this.roleRepository.findOne({
      where: {
        roleId: roleId,
      },
      relations: ['permissions'],
    });

    const permissionIds = permissions.map((permission) => permission.id);

    return {
      data: {
        ...rest,
        permissionIds,
      },
    };
  }
}
