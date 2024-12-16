import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { RequireLogin, RequirePermission } from '../custom.decorator';
import { UnloginException } from '../unlogin.filter';

interface RefreshTokenPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

@Controller('user')
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
    return await this.userService.refreshToken(userId, true);
  }

  @Get('init-db')
  async initDb() {
    await this.userService.initDb();
    return 'done';
  }
}
