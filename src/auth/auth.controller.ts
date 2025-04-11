import {
  BadRequestException,
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
import { Request, Response } from 'express';
import {
  AuthErrorCode,
  AuthException,
} from '../common/exceptions/auth.exception';

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
    const user = await this.userService.login(loginUser);
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
    const userInfo = await this.userService.login(loginUser);
    const { accessToken, refreshToken } =
      this.userService.generateToken(userInfo);
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
    });

    return {
      data: {
        userInfo,
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
      throw new AuthException(AuthErrorCode.LOGIN_EXPIRED);
    }
  }

  @Get('admin/refresh')
  async adminRefresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken } = request.cookies;
    if (!refreshToken) throw new BadRequestException('请先登录');
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
