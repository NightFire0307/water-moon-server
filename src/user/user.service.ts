import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Repository } from 'typeorm';
import { Permission } from './entities/permissions.entity';
import { hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  @Inject(ConfigService)
  private configService: ConfigService;

  @InjectRepository(User)
  private userRepository: Repository<User>;

  @InjectRepository(Role)
  private roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  async initDb() {
    const saltRounds: string = this.configService.get('hash_salt_rounds');
    if (!saltRounds) {
      throw new Error('Salt Rounds configuration is missing');
    }
    console.log(typeof saltRounds);
    const user1 = new User();

    user1.username = 'admin';
    user1.nickname = 'admin';
    user1.isAdmin = true;
    user1.isFrozen = false;
    user1.password = await hash('123456', parseInt(saltRounds));

    const user2 = new User();
    user2.username = 'admin1';
    user2.nickname = 'admin1';
    user2.isAdmin = false;
    user2.isFrozen = false;
    user2.password = await hash('123456', parseInt(saltRounds));

    const role = new Role();
    role.name = '管理员';

    const role2 = new Role();
    role2.name = '选片师';

    const permission1 = new Permission();
    permission1.code = 'ccc';
    permission1.description = '访问 ccc 接口';

    user1.roles = [role, role2];
    user2.roles = [role2];

    role.permissions = [permission1];

    await this.userRepository.save([user1, user2]);
    await this.roleRepository.save([role, role2]);
    await this.permissionRepository.save([permission1]);
  }
}
