import {
  Injectable,
  OnApplicationBootstrap,
  RequestMethod,
} from '@nestjs/common';
import { Reflector, ModulesContainer } from '@nestjs/core';
import { PERMISSION_KEY, type PermissionMetadata } from './custom.decorator';
import { Permission } from '../modules/auth/entities/permissions.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OmitType } from '@nestjs/swagger';

class CreatePermissionsDto extends OmitType(Permission, [
  'id',
  'createTime',
  'updateTime',
]) { }

@Injectable()
export class PermissionScanService implements OnApplicationBootstrap {
  constructor(
    private reflector: Reflector,
    private modulesContainer: ModulesContainer,
  ) { }

  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  async onApplicationBootstrap() {
    const permissions = this.scanPermissions();

    await this.savePermissions(permissions);
  }

  scanPermissions() {
    const permissions = {};
    // const permissions: CreatePermissionsDto[] = [];

    // 遍历所有模块
    for (const module of this.modulesContainer.values()) {
      const controllers = module.controllers;
      // 遍历模块中的所有控制器实例
      for (const controller of controllers.values()) {
        // 获取控制器实例
        const instance = controller.instance;
        // 获取控制器实例的原型
        const prototype = Object.getPrototypeOf(instance);
        // 获取控制器级别路径
        const controllerPath = Reflect.getMetadata('path', controller.metatype);
        // 获取控制器的权限元数据
        const controllerPermissions = this.reflector.get<PermissionMetadata>(
          PERMISSION_KEY,
          controller.metatype,
        );

        if (!controllerPermissions) continue;

        permissions[instance.constructor.name] = {
          ...controllerPermissions,
        };

        // 遍历控制器原型上的所有方法
        for (const methodName of Object.getOwnPropertyNames(prototype)) {
          const method = prototype[methodName];
          if (typeof method === 'function') {
            const methodPath = Reflect.getMetadata('path', method);
            const requiredPermissions = this.reflector.get(
              PERMISSION_KEY,
              method,
            );

            if (!requiredPermissions || requiredPermissions.type === 'group') {
              continue;
            }

            if (!permissions[instance.constructor.name].children) {
              permissions[instance.constructor.name].children = [];
            }

            permissions[instance.constructor.name].children.push({
              ...requiredPermissions,
              endpoint: `/${controllerPath}${methodPath}`,
              action:
                RequestMethod[Reflect.getMetadata('method', method)] ||
                'UNKNOWN',
            });
          }
        }
      }
    }

    return permissions;
  }

  async savePermissions(permissions) {
    const parentPermissionEntities = [];

    // 先保存父级权限
    for (const key in permissions) {
      const permission = permissions[key];
      const permissionEntity = {
        name: permission.name,
        code: permission.code,
        endpoint: null,
        action: null,
        type: permission.type,
        description: permission.description,
        parentId: null,
        createTime: new Date(),
        updateTime: new Date(),
      };

      parentPermissionEntities.push(permissionEntity);
    }

    // 查找数据库中已存在的父级权限
    const existingParentPermissions = await this.permissionRepository.find({
      where: { code: In(parentPermissionEntities.map((p) => p.code)) },
    });

    // 过滤出不存在的父级权限
    const newParentPermissions = parentPermissionEntities.filter(
      (p) => !existingParentPermissions.some((ep) => ep.code === p.code),
    );

    // 批量插入新的父级权限
    if (newParentPermissions.length > 0) {
      await this.permissionRepository.save(newParentPermissions);
    }

    // 获取所有父级权限
    const parentPermissions = await this.permissionRepository.find();
    const subPermissionEntities = [];
    // 处理子权限
    for (const key in permissions) {
      const permission = permissions[key];
      if (permission.children) {
        for (const child of permission.children) {
          const parentId = parentPermissions.find(
            (parent) => parent.code === child.code.split(':')[0],
          )?.id;

          if (parentId && child.type === 'button') {
            subPermissionEntities.push({
              name: child.name,
              code: child.code,
              endpoint: child.endpoint,
              action: child.action,
              type: child.type,
              description: child.description,
              parentId: parentId,
              createTime: new Date(),
              updateTime: new Date(),
            });
          }
        }
      }
    }

    // 过滤出已存在的子权限
    const existingSubPermissions = await this.permissionRepository.find({
      where: { code: In(subPermissionEntities.map((p) => p.code)) },
    });

    // 过滤出不存在的子权限
    const newSubPermissions = subPermissionEntities.filter(
      (p) => !existingSubPermissions.some((ep) => ep.code === p.code),
    );

    // 去重
    const uniqueNewSubPermissions = Array.from(
      new Map(newSubPermissions.map((item) => [item.code, item])).values(),
    );

    await this.permissionRepository.save(uniqueNewSubPermissions);
  }
}
