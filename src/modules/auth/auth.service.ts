import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Repository } from 'typeorm';
import { Permission, PermissionAction } from './entities/permissions.entity';
import { compare, hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import * as qiniu from 'qiniu';
import * as Minio from 'minio';
import { Redis } from 'ioredis';

@Injectable()
export class AuthService {
  @Inject(ConfigService)
  private readonly configService: ConfigService;

  @Inject(JwtService)
  private readonly jwtService: JwtService;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  @Inject('MINIO_CLIENT')
  private readonly minioClient: Minio.Client;

  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private readonly permissionRepository: Repository<Permission>;

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

    user1.roles = [role, role2];
    user2.roles = [role2];

    await this.userRepository.save([user1, user2]);
    await this.roleRepository.save([role, role2, role3]);
  }

  async login(loginUserDto: LoginUserDto) {
    const userInfo = await this.userRepository
      .createQueryBuilder('user')
      .where('user.username = :username', { username: loginUserDto.username })
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('roles.permissions', 'permissions')
      .select([
        'user.user_id',
        'user.username',
        'user.nickname',
        'user.phoneNumber',
        'user.isAdmin',
        'user.password',
        'roles',
        'permissions',
      ])
      .cache(60000)
      .getOne();

    if (!userInfo) {
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
    }

    compare(loginUserDto.password, userInfo.password).then((result) => {
      if (!result) {
        throw new HttpException('密码错误', HttpStatus.BAD_REQUEST);
      }
    });

    // 遍历用户角色，获取权限
    const permissions = new Set<string>();
    userInfo.roles.forEach((role) => {
      role.permissions.forEach((permission) => {
        if (permission.code.split(':').length === 2) {
          permissions.add(permission.code);
        }
      });
    });

    // 缓存用户权限(24小时)
    // const pipeline = this.redisClient.pipeline();
    // 移除旧权限
    // pipeline.del(`permissions:${result.user_id}`);
    // pipeline.lpush(`permissions:${result.user_id}`, ...result.permissions);
    // pipeline.expire(`permissions:${result.user_id}`, 60 * 60 * 24);
    // await pipeline.exec();

    return {
      user_id: userInfo.user_id,
      username: userInfo.username,
      nickname: userInfo.nickname,
      isAdmin: userInfo.isAdmin,
      isFrozen: userInfo.isFrozen,
      roles: userInfo.roles.map((role) => ({
        roleId: role.role_id,
        name: role.name,
      })),
      permissions: Array.from(permissions),
    };
  }

  async findUserById(userId: number, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
        isAdmin,
      },
      relations: ['roles', 'roles.permissions'],
    });

    return {
      id: user.user_id,
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
  generateToken(vo: { user_id: number; permissions: string[] }): {
    accessToken: string;
    refreshToken: string;
  } {
    console.log(vo);

    // 生成 AccessToken
    const accessToken = this.jwtService.sign(
      {
        userId: vo.user_id,
        permissions: vo.permissions,
      },
      {
        expiresIn: this.configService.get('jwt_access_token_expires_time'),
      },
    );

    // 生成 RefreshToken
    const refreshToken = this.jwtService.sign(
      {
        userId: vo.user_id,
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

  async getOssToken() {
    const accessKey = this.configService.get('oss_access_key');
    const secretKey = this.configService.get('oss_secret_key');
    const scope = this.configService.get('oss_bucket');
    const expires = Number(this.configService.get('oss_token_expire_time'));
    const options = {
      scope: `${scope}`,
      expires,
      returnBody:
        '{"key": $(key), "hash": $(etag), "bucket": $(bucket), "fsize": $(fsize)}, "name": $(x:name)}',
    };

    const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    const putPolicy = new qiniu.rs.PutPolicy(options);
    const uploadToken = putPolicy.uploadToken(mac);
    return {
      uploadToken,
    };
  }

  async getMinioToken(orderNumber: string, fileName: string) {
    const bucket = 'water-moon';
    const expires = new Date();
    expires.setSeconds(24 * 60 * 60);

    const policy = this.minioClient.newPostPolicy();
    policy.setKey(`${orderNumber}/${fileName}`);
    policy.setBucket(bucket);
    policy.setExpires(expires);

    const { postURL, formData } =
      await this.minioClient.presignedPostPolicy(policy);

    return {
      postURL,
      formData,
    };
  }
}
