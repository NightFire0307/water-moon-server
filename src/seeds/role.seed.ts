import { INestApplicationContext } from "@nestjs/common";
import { Role } from "../modules/role/entities/role.entity";
import { DataSource } from "typeorm";

export class RoleSeed {
  async run(app: INestApplicationContext) {
    const dataSource = app.get(DataSource);
    const roleRepo = dataSource.getRepository(Role);

    // 添加超级管理员角色
    const exists = await roleRepo.findOne({
      where: { name: '超级管理员' },
    });

    if (!exists) {
      await roleRepo.insert({
        code: 'super_admin',
        name: '超级管理员',
        description: '拥有系统的所有权限',
      });
      console.log('添加超级管理员角色成功');
    } else {
      console.log('超级管理员角色已存在，跳过添加');
    }
  }
}