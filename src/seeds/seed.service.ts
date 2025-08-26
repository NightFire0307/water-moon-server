import { User } from "@/modules/user/entities/user.entity";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { hash } from 'bcrypt'
import { Role } from "@/modules/role/entities/role.entity";

@Injectable()
export class SeedService {
  @Inject(ConfigService)
  private readonly configService: ConfigService;

  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

  // 初始化超级管理员
  async initialSuperAdmin() {
    const hashSaltRounds = this.configService.get<number>('HASH_SALT_ROUNDS', 10);
    const password = await hash('superadmin', hashSaltRounds)

    const exist = await this.userRepository.findOne({
      where: {
        username: 'superadmin'
      }
    })

    if (!exist) {
      console.log('Creating super admin user...');
      await this.userRepository.insert({
        username: 'superadmin',
        password,
        nickname: '超级管理员',
        phone: '13800138000',
      })
      console.log('Super_Admin user created successfully.');
    } else {
      console.log('Super admin already exists.');
    }
  }

  // 初始化角色
  async initialRoles() {
    const exist = await this.roleRepository.findOne({
      where: {
        name: '超级管理员'
      }
    })

    if (!exist) {
      console.log('Creating super admin role...');
      await this.roleRepository.insert({
        code: 'super_admin',
        name: '超级管理员',
        description: '拥有系统的所有权限',
      })
      console.log('Super_Admin role created successfully.');
    } else {
      console.log('Super admin role already exists.');
    }
  }

  // 关联超级管理员与角色
  async linkSuperAdminRole() {
    const user = await this.userRepository.findOne({
      where: {
        username: 'superadmin'
      },
      relations: ['roles']
    })

    const role = await this.roleRepository.findOne({
      where: {
        code: 'super_admin'
      }
    })

    if (user && role) {
      const hasRole = user.roles.some(r => r.roleId === role.roleId);
      if (!hasRole) {
        console.log('Linking super admin user with super admin role...');
        user.roles.push(role);
        await this.userRepository.save(user);
        console.log('Super admin user linked with super admin role successfully.');
      } else {
        console.log('Super admin user already has super admin role.');
      }
    } else {
      console.log('Super admin user or role does not exist. Cannot link.');
    }
  }
}