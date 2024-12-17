import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '../auth/entities/role.entity';
import { In, Repository } from 'typeorm';
import { PaginationQuery } from '../common/custom.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto } from './dto/update-role.dto';
import { Permission } from '../auth/entities/permissions.entity';

@Injectable()
export class RoleService {
  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private readonly permissionRepository: Repository<Permission>;

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
      id,
      ...updateRoleDto,
    });

    if (!role) return '角色不存在';

    await this.roleRepository.save(role);
    return '更新成功';
  }

  async removeRole(id: number) {
    const role = await this.roleRepository.findOne({
      where: {
        id,
      },
    });

    if (!role) return '删除失败！角色不存在';
    await this.roleRepository.remove(role);
    return '删除成功';
  }

  async updateRolePermissions(
    id: number,
    updateRolePermissionsDto: UpdateRolePermissionsDto,
  ) {
    const { permissionsIds } = updateRolePermissionsDto;
    const role_permissions = await this.roleRepository.findOne({
      where: {
        id,
      },
      relations: {
        permissions: true,
      },
    });

    if (!role_permissions) return '角色不存在';

    const permissions = await this.permissionRepository.find({
      where: {
        id: In(permissionsIds),
      },
    });

    role_permissions.permissions = permissions;
    await this.roleRepository.save(role_permissions);

    return 'done';
  }
}
