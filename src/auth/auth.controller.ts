import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { RequireLogin, RequirePermission } from '../common/custom.decorator';
import { UnloginException } from '../unlogin.filter';
import { FileArrayDto } from './dto/mino-file-array';

interface RefreshTokenPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

@Controller('auth')
export class AuthController {
  @Inject(AuthService)
  private userService: AuthService;

  @Inject(JwtService)
  private jwtService: JwtService;

  @Post('login')
  async userLogin(@Body() loginUser: LoginUserDto) {
    const vo = await this.userService.login(loginUser, false);
    const { accessToken, refreshToken } = this.userService.generateToken(vo);

    vo.accessToken = accessToken;
    vo.refreshToken = refreshToken;
    return vo;
  }

  @Post('admin/login')
  @HttpCode(200)
  async adminLogin(@Body() loginUser: LoginUserDto) {
    const vo = await this.userService.login(loginUser, true);
    const { accessToken, refreshToken } = this.userService.generateToken(vo);

    vo.accessToken = accessToken;
    vo.refreshToken = refreshToken;
    return vo;
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
    @Query('order_number') orderNumber: string,
    @Query('file_name') fileName: string,
  ) {
    return await this.userService.getMinioToken(orderNumber, fileName);
  }

  @Get('init-db')
  async initDb() {
    await this.userService.initDb();
    return 'done';
  }
}
