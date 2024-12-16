import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Repository } from 'typeorm';
import { Permission } from './entities/permissions.entity';
import { compare, hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginUserVo } from './vo/login-user.vo';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  @Inject(ConfigService)
  private configService: ConfigService;

  @Inject(JwtService)
  private jwtService: JwtService;

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

    const role3 = new Role();
    role3.name = '普通用户';

    const permission1 = new Permission();
    permission1.code = 'ccc';
    permission1.description = '访问 ccc 接口';

    user1.roles = [role, role2];
    user2.roles = [role2];

    role.permissions = [permission1];

    await this.userRepository.save([user1, user2]);
    await this.roleRepository.save([role, role2, role3]);
    await this.permissionRepository.save([permission1]);
  }

  async login(loginUserDto: LoginUserDto, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        username: loginUserDto.username,
        isAdmin,
      },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
    }

    compare(loginUserDto.password, user.password).then((result) => {
      if (!result) {
        throw new HttpException('密码错误', HttpStatus.BAD_REQUEST);
      }
    });

    const vo = new LoginUserVo();
    vo.userinfo = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      isFrozen: user.isFrozen,
      isAdmin: user.isAdmin,
      roles: user.roles.map((role) => role.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.forEach((permission) => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, []),
      createTime: user.createTime.toString(),
      updateTime: user.updateTime.toString(),
    };

    return vo;
  }

  async findUserById(userId: number, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        isAdmin,
      },
      relations: ['roles', 'roles.permissions'],
    });

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      roles: user.roles.map((item) => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.forEach((permission) => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, []),
    };
  }

  /**
   * 生成双Token
   * @param { LoginUserVo } vo
   * @returns {{ accessToken: string, refreshToken: string }} 返回access_token 和 refresh_token
   */
  generateToken(vo: LoginUserVo): {
    accessToken: string;
    refreshToken: string;
  } {
    // 生成 AccessToken
    const accessToken = this.jwtService.sign(
      {
        userId: vo.userinfo.id,
        username: vo.userinfo.username,
        roles: vo.userinfo.roles,
        permissions: vo.userinfo.permissions,
      },
      {
        expiresIn: this.configService.get('jwt_access_token_expires_time'),
      },
    );

    // 生成 RefreshToken
    const refreshToken = this.jwtService.sign(
      {
        userId: vo.userinfo.id,
      },
      {
        expiresIn: this.configService.get('jwt_refresh_token_expires_time'),
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * 根据 refreshToken 刷新 accessToken
   * @param {number} userId
   * @param {boolean} isAdmin
   */
  async refreshToken(userId: number, isAdmin: boolean) {
    try {
      const user = await this.findUserById(userId, isAdmin);

      const access_token = this.jwtService.sign(
        {
          userId: user.id,
          username: user.username,
          roles: user.roles,
          permissions: user.permissions,
        },
        {
          expiresIn: this.configService.get('jwt_access_token_expires_time'),
        },
      );

      const refresh_token = this.jwtService.sign(
        {
          userId: user.id,
        },
        {
          expiresIn: this.configService.get('jwt_refresh_token_expires_time'),
        },
      );

      return { access_token, refresh_token };
    } catch {
      throw new UnauthorizedException('Token 已失效');
    }
  }
}
