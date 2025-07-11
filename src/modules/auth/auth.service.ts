import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Repository } from 'typeorm';
import { Permission } from './entities/permissions.entity';
import { compare } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AdminLoginDto } from './dto/admin-login.dto';
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

  async login(loginUserDto: AdminLoginDto) {
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
        'user.password',
        'user.isFrozen',
        'roles',
        'permissions',
      ])
      .cache(3000)
      .getOne();

    if (!userInfo) {
      throw new UnauthorizedException('用户不存在或密码错误');
    }

    if (userInfo.isFrozen) {
      throw new ForbiddenException('用户已被冻结，请联系管理员');
    }

    // 验证密码
    const match = await compare(loginUserDto.password, userInfo.password)
    if (!match) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 遍历用户角色，获取权限
    const permissions = new Set<string>();
    // 如果是超级管理员，直接赋予所有权限
    const isSuperAdmin = userInfo.roles.some(
      (role) => role.code === 'super_admin',
    );

    if (isSuperAdmin) {
      permissions.add('*:*');
    } else {
      userInfo.roles.forEach((role) => {
        role.permissions.forEach((permission) => {
          if (permission.code.split(':').length === 2) {
            permissions.add(permission.code.toLowerCase());
          }
        });
      });
    }

    // 缓存用户权限(24小时)
    // const pipeline = this.redisClient.pipeline();
    // 移除旧权限
    // pipeline.del(`permissions:${result.user_id}`);
    // pipeline.lpush(`permissions:${result.user_id}`, ...result.permissions);
    // pipeline.expire(`permissions:${result.user_id}`, 60 * 60 * 24);
    // await pipeline.exec();

    return {
      userId: userInfo.user_id,
      username: userInfo.username,
      nickname: userInfo.nickname,
      roles: userInfo.roles.map((role) => role.code),
      permissions: Array.from(permissions),
    };
  }

  async findUserById(userId: number) {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
      relations: ['roles', 'roles.permissions'],
    });

    return {
      id: user.user_id,
      username: user.username,
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
  generateToken(vo: { userId: number; roles: string[], permissions: string[] }): {
    accessToken: string;
    refreshToken: string;
  } {
    // 生成 AccessToken
    const accessToken = this.jwtService.sign(
      {
        userId: vo.userId,
        roles: vo.roles,
        permissions: vo.permissions,
      },
      {
        expiresIn: this.configService.get('jwt_access_token_expires_time'),
      },
    );

    // 生成 RefreshToken
    const refreshToken = this.jwtService.sign(
      {
        userId: vo.userId,
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
   */
  async refreshToken(userId: number) {
    try {
      const user = await this.findUserById(userId);

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
