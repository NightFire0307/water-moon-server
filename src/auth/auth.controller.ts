import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { RequireLogin } from '../common/custom.decorator';
import { UnloginException } from '../unlogin.filter';

interface RefreshTokenPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

@Controller('auth')
export class AuthController {
  @Inject(AuthService)
  private readonly userService: AuthService;

  @Inject(JwtService)
  private readonly jwtService: JwtService;

  @Post('login')
  async userLogin(@Body() loginUser: LoginUserDto) {
    const user = await this.userService.login(loginUser, false);
    const { accessToken, refreshToken } = this.userService.generateToken(user);

    return {
      data: {
        user,
        accessToken,
        refreshToken,
      },
    };
  }

  @Post('admin/login')
  @HttpCode(200)
  @UseInterceptors(ClassSerializerInterceptor)
  async adminLogin(@Body() loginUser: LoginUserDto) {
    const user = await this.userService.login(loginUser, true);
    const { accessToken, refreshToken } = this.userService.generateToken(user);
    return {
      data: {
        user,
        accessToken,
        refreshToken,
      },
    };
  }

  @Get('refresh')
  async refresh(@Query('refreshToken') refreshToken: string) {
    try {
      const { userId } =
        this.jwtService.verify<RefreshTokenPayload>(refreshToken);
      return await this.userService.refreshToken(userId, false);
    } catch {
      throw new UnloginException('Token 已失效，请重新登录');
    }
  }

  @Get('admin/refresh')
  async adminRefresh(@Query('refreshToken') refreshToken: string) {
    const { userId } =
      this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    const data = await this.userService.refreshToken(userId, true);
    return { data, message: '刷新成功' };
  }

  @Get('admin/oss-token')
  @RequireLogin()
  async getOssToken(
    @Query('orderNumber') orderNumber: string,
    @Query('fileName') fileName: string,
  ) {
    return await this.userService.getMinioToken(orderNumber, fileName);
  }

  @Get('init-db')
  async initDb() {
    await this.userService.initDb();
    return 'done';
  }
}
