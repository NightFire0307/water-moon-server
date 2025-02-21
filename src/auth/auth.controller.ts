import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { RequireLogin } from '../common/custom.decorator';
import { UnloginException } from '../unlogin.filter';
import { Response, Request } from 'express';

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
  async adminLogin(
    @Body() loginUser: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.userService.login(loginUser, true);
    const { accessToken, refreshToken } = this.userService.generateToken(user);
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
    });

    return {
      data: {
        user,
        accessToken,
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
  async adminRefresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    console.log(request.cookies);
    const { refreshToken } = request.cookies;
    const { userId } =
      this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    const { access_token, refresh_token } = await this.userService.refreshToken(
      userId,
      true,
    );

    // 更新 refreshToken
    response.cookie('refreshToken', refresh_token, {
      httpOnly: true,
    });

    return { data: { access_token }, message: '刷新成功' };
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
