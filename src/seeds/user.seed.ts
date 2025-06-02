import { INestApplicationContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { hash } from 'bcrypt'
import { User } from "../modules/auth/entities/user.entity";
import { DataSource } from "typeorm";
import { Role } from "../modules/role/entities/role.entity";

// 初始化用户数据
export class UserSeed {
  async run(app: INestApplicationContext, config: ConfigService) {
    // 添加超级管理员用户
    const dataSource = app.get(DataSource)
    const userRepo = dataSource.getRepository(User);
    const roleRepo = dataSource.getRepository(Role)

    const exists = await userRepo.findOne({
      where: { username: 'admin' }
    })

    if (!exists) {
      const saltRound = config.get<string>('hash_salt_rounds');
      const password = await hash('123456', parseInt(saltRound ?? '10', 10))

      const role = await roleRepo.findOne({
        where: { name: '超级管理员' }
      })

      await userRepo.save({
        username: 'admin',
        nickname: '超级管理员',
        phoneNumber: '13800138000',
        password,
        roles: [role]
      })
      console.log('添加超级管理员用户成功');
    } else {
      console.log('超级管理员用户已存在，跳过添加');
    }
  }
}