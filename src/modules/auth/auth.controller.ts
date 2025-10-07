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
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtService } from '@nestjs/jwt';
import { Public, RequireLogin } from '@/common/decorators/auth.decorator';
import { Request, Response } from 'express';
import { UserInfo } from '@/common/decorators/context.decorator';

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

  // 管理端登录
  @Post('admin/login')
  @HttpCode(200)
  @UseInterceptors(ClassSerializerInterceptor)
  @Public()
  async adminLogin(
    @Body() loginUser: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userInfo = await this.userService.login(loginUser);
    const { accessToken, refreshToken } =
      this.userService.generateToken(userInfo);
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
    });

    return {
      userInfo,
      accessToken,
    };
  }

  @Post('admin/refresh')
  @Public()
  async adminRefresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies;
    if (!cookies.refreshToken) throw new UnauthorizedException('请重新登录');
    const { userId } =
      this.jwtService.verify<RefreshTokenPayload>(cookies.refreshToken);
    console.log('verify', userId);
    const { accessToken, refreshToken } = await this.userService.refreshToken(
      userId,
    );

    // 更新 refreshToken
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
    });

    return {
      accessToken,
    };
  }

  @Post('admin/logout')
  @Public()
  async adminLogout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies;
    if (cookies.refreshToken) {
      response.clearCookie('refreshToken')
    }

    return { msg: '退出登录成功' };
  }

  @Get('admin/oss-token')
  @RequireLogin()
  async getOssToken(
    @Query('orderNumber') orderNumber: string,
    @Query('fileName') fileName: string,
  ) {
    return await this.userService.getMinioToken(orderNumber, fileName);
  }

  @Get('me')
  @RequireLogin()
  async getCurrentUser(
    @UserInfo() userInfo
  ) {
    return await this.userService.getCurrentUserInfo(userInfo.userId)
  }
}
