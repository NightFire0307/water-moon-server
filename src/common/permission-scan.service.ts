import {
  Injectable,
  OnApplicationBootstrap,
  RequestMethod,
} from '@nestjs/common';
import { Reflector, ModulesContainer } from '@nestjs/core';
import { PERMISSION_KEY } from './custom.decorator';
import { Permission } from '../modules/auth/entities/permissions.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OmitType } from '@nestjs/swagger';

class CreatePermissionsDto extends OmitType(Permission, [
  'id',
  'createTime',
  'updateTime',
]) {}

@Injectable()
export class PermissionScanService implements OnApplicationBootstrap {
  constructor(
    private reflector: Reflector,
    private modulesContainer: ModulesContainer,
  ) {}

  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  async onApplicationBootstrap() {
    const permissions = this.scanPermissions();
    await this.savePermissions(permissions);
  }

  scanPermissions() {
    const permissions: CreatePermissionsDto[] = [];

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
        // 遍历控制器原型上的所有方法
        for (const methodName of Object.getOwnPropertyNames(prototype)) {
          const method = prototype[methodName];
          if (typeof method === 'function') {
            const methodPath = Reflect.getMetadata('path', method);
            const requiredPermissions = this.reflector.get<string[]>(
              PERMISSION_KEY,
              method,
            );
            const description: string = Reflect.getMetadata(
              'description',
              method,
            );

            if (requiredPermissions) {
              const fullPath = `/${controllerPath}${methodPath}`.replace(
                /\/$/,
                '',
              );

              permissions.push({
                name: Array.isArray(requiredPermissions)
                  ? requiredPermissions.join('_')
                  : requiredPermissions,
                module: instance.constructor.name,
                endpoint: fullPath,
                action:
                  RequestMethod[Reflect.getMetadata('method', method)] ||
                  'UNKNOWN',
                description,
              });
            }
          }
        }
      }
    }

    return permissions;
  }

  async savePermissions(permissions: CreatePermissionsDto[]) {
    for (const permission of permissions) {
      const existingPermission = await this.permissionRepository.findOne({
        where: {
          name: permission.name,
        },
      });

      if (!existingPermission) {
        await this.permissionRepository.save(permission);
      }
    }
  }
}
