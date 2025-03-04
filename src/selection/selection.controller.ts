import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { Request, Response } from 'express';
import { OrderInfo } from '../common/custom.decorator';
import { CustomLogin } from './guard/custom-login.guard';
import { VerifySurl } from './guard/verify-surl.guard';
import { SelectionPhotosUpdate } from './dto/selection-photos-update.dto';

@Controller('selection')
export class SelectionController {
  constructor(private readonly selectionService: SelectionService) {}

  // 校验短链和密码
  @Post('validate')
  @HttpCode(200)
  async validateSelection(
    @Body() selectionLogin: SelectionLoginDto,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const orderId = this.selectionService.decodeOrderId(
      selectionLogin.short_url,
    );
    if (isNaN(Number(orderId))) throw new BadRequestException('无效的短链');

    const { access_token, refresh_token } =
      await this.selectionService.validateLinkAndPassword(
        +orderId,
        selectionLogin,
      );

    response.cookie('selection_refresh_token', refresh_token, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });

    return {
      data: {
        access_token,
      },
    };
  }

  @Post('verify/:short_url')
  @UseGuards(CustomLogin, VerifySurl)
  @HttpCode(200)
  verifyShortLinkAndToken(@OrderInfo('orderId') orderId: number) {
    return { data: { orderId } };
  }

  @Get('products/:short_url')
  @UseGuards(CustomLogin, VerifySurl)
  async getSelectedProducts(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getSelectedProducts(orderId);
  }

  // 获取选片照片
  @Get('photos')
  @UseGuards(CustomLogin)
  async getSelectedPhotos(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getSelectedPhotos(orderId);
  }

  // 更新照片选择
  @Put('photos')
  @UseGuards(CustomLogin, VerifySurl)
  async updateSelectedPhotos(@Body() selectedPhotos: SelectionPhotosUpdate) {
    await this.selectionService.updateSelectedPhotos(selectedPhotos);
    return { data: 'done' };
  }

  // 提交选片结果
  @Post('submit/:short_url')
  submitSelection() {}

  // 刷新access_token
  @Post('refresh/:short_url')
  async refreshToken(@Param() surl: string, @Req() request: Request) {
    const refreshToken: string | undefined =
      request.cookies['selection_refresh_token'];
    if (!refreshToken) throw new BadRequestException('无效的 refresh token');
    return await this.selectionService.refreshToken(refreshToken, surl);
  }
}
