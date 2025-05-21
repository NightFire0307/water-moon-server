import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission } from '../auth/entities/permissions.entity';
import { Repository } from 'typeorm';
import { PaginationQuery } from '../../common/custom.decorator';

@Injectable()
export class PermissionService {
  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  async getPermissions(pagination: PaginationQuery) {
    const result = await this.permissionRepository.find();

    function buildTree(data: Permission[]) {
      const tree = [];
      const map = new Map<number, any>();

      // 先将所有节点存入 map，并初始化 children 为 []
      data.forEach((item) => {
        map.set(item.id, { ...item, children: [] });
      });

      // 建立父子关系
      data.forEach((item) => {
        const node = map.get(item.id);
        if (item.parentId === null) {
          tree.push(node);
        } else {
          const parent = map.get(Number(item.parentId));
          if (parent) {
            parent.children.push(node);
          }
        }
      });

      // 递归移除空的 children 字段
      function clean(node: any) {
        if (node.children && node.children.length === 0) {
          delete node.children;
        } else if (node.children) {
          node.children.forEach(clean);
        }
      }

      tree.forEach(clean);

      return tree;
    }

    const tree = buildTree(result);

    return {
      data: tree,
    };
  }
}
