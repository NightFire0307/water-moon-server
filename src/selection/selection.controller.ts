import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { Request, Response } from 'express';
import { OrderInfo } from '../common/custom.decorator';
import { CustomLogin } from './guard/custom-login.guard';
import { VerifySurl } from './guard/verify-surl.guard';
import { ProductPhotoSelectionDto } from './dto/selection-photos-update.dto';
import { SelectionRemarkUpdateDto } from './dto/selection-remark-update.dto';

@Controller('selection')
export class SelectionController {
  constructor(private readonly selectionService: SelectionService) {}

  // 校验短链和密码
  @Post('auth')
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

  @Post('auth/verify/:short_url')
  @HttpCode(200)
  async verifyToken(@Param('short_url') shortUrl: string) {
    return this.selectionService.verifyToken(shortUrl);
  }

  // 刷新access_token
  @Post('auth/refresh')
  async refreshToken(@Req() request: Request) {
    const refreshToken: string | undefined =
      request.cookies['selection_refresh_token'];
    if (!refreshToken) throw new UnauthorizedException('无效的 refresh token');
    return await this.selectionService.refreshToken(refreshToken);
  }

  @Get(':short_url/products')
  @UseGuards(CustomLogin, VerifySurl)
  async getProducts(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getSelectedProducts(orderId);
  }

  // 获取选片照片
  @Get('photos')
  @UseGuards(CustomLogin)
  async getPhotos(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getSelectedPhotos(orderId);
  }

  // 更新照片选择
  @Patch('photos')
  @UseGuards(CustomLogin)
  async updatePhotos(
    @OrderInfo('orderId') orderId: number,
    @Body() selectedPhotos: ProductPhotoSelectionDto,
  ) {
    return await this.selectionService.updateSelectedPhotos(
      orderId,
      selectedPhotos,
    );
  }

  // 更新照片备注
  @Patch('photos/remark')
  @UseGuards(CustomLogin)
  async updatePhotoRemark(@Body() remarkUpdateDto: SelectionRemarkUpdateDto) {
    return await this.selectionService.updatePhotoRemark(remarkUpdateDto);
  }

  // 移除照片下所有的标记
  @Patch('photos/:photoId/remove-all-tag')
  @UseGuards(CustomLogin)
  async removeAllTags(
    @OrderInfo('orderId') orderId: number,
    @Param('photoId') photoId: number,
  ) {
    return await this.selectionService.removeAllTags(orderId, photoId);
  }

  // 锁定选片结果
  @Post(':short_url/submit')
  @UseGuards(CustomLogin, VerifySurl)
  @HttpCode(200)
  async submitOrder(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.submitOrder(orderId);
  }
}
