import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import { compare } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtService } from '@nestjs/jwt';
import * as Minio from 'minio';

@Injectable()
export class AuthService {
  @Inject(ConfigService)
  private readonly configService: ConfigService;

  @Inject(JwtService)
  private readonly jwtService: JwtService;

  @Inject('MINIO_CLIENT')
  private readonly minioClient: Minio.Client;

  @InjectRepository(User)
  private readonly userRepository: Repository<User>;


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
        'user.phone',
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

    return {
      userId: userInfo.user_id,
      username: userInfo.username,
      nickname: userInfo.nickname,
      roles: userInfo.roles.map((role) => role.code),
      permissions: Array.from(permissions),
    };
  }

  async getCurrentUserInfo(userId: number) {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
      relations: ['roles', 'roles.permissions'],
    });

    return {
      userId: user.user_id,
      nickname: user.nickname,
      username: user.username,
      roles: user.roles.map((item) => item.code),
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
      const userInfo = await this.getCurrentUserInfo(userId);

      const accessToken = this.jwtService.sign(
        {
          userId: userInfo.userId,
          roles: userInfo.roles,
          permissions: userInfo.permissions,
        },
        {
          expiresIn: this.configService.get('jwt_access_token_expires_time'),
        },
      );

      const refreshToken = this.jwtService.sign(
        {
          userId: userInfo.userId,
        },
        {
          expiresIn: this.configService.get('jwt_refresh_token_expires_time'),
        },
      );

      return { accessToken, refreshToken };
    } catch {
      throw new UnauthorizedException('Token 已失效');
    }
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
