import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { LoginUserDto } from './dto/login-user.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

interface RefreshTokenPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

@Controller('user')
export class UserController {
  @Inject(UserService)
  private userService: UserService;

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
    const { userId } =
      this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    return await this.userService.refreshToken(userId, false);
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
