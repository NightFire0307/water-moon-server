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
  UseGuards,
} from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { Request, Response } from 'express';
import {
  OrderInfo,
  Pagination,
  PaginationQuery,
} from '../../common/custom.decorator';
import { CustomLogin } from './guard/custom-login.guard';
import { VerifySurl } from './guard/verify-surl.guard';
import { ProductPhotoSelectionDto } from './dto/selection-photos-update.dto';
import { SelectionRemarkUpdateDto } from './dto/selection-remark-update.dto';
import { PhotoService } from '../photo/photo.service';
import {
  AuthErrorCode,
  AuthException,
} from '../../common/exceptions/auth.exception';

@Controller('selection')
export class SelectionController {
  constructor(
    private readonly selectionService: SelectionService,
    private readonly photoService: PhotoService,
  ) { }

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
    if (!refreshToken) throw new AuthException(AuthErrorCode.INVALID_TOKEN);
    return await this.selectionService.refreshToken(refreshToken);
  }

  @Get(':short_url/order_info')
  @UseGuards(CustomLogin, VerifySurl)
  async getOrderInfo(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getOrderInfo(orderId);
  }

  // 获取选片照片
  @Get('photos')
  @UseGuards(CustomLogin)
  async getPhotos(
    @OrderInfo('orderId') orderId: number,
    @Pagination() pagination: PaginationQuery,
  ) {
    return await this.photoService.getPhotosByOrderId(orderId, pagination);
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
  async updatePhotoRemark(
    @OrderInfo('orderId') orderId: number,
    @Body() remarkUpdateDto: SelectionRemarkUpdateDto,
  ) {
    return await this.selectionService.updatePhotoRemark(
      orderId,
      remarkUpdateDto,
    );
  }

  // 获取照片备注
  @Get('photos/:photoId/remark/')
  @UseGuards(CustomLogin)
  async getPhotoRemarkById(@Param('photoId') photoId: number) {
    return await this.selectionService.getPhotoRemarkById(photoId);
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
  @Post(':orderId')
  @UseGuards(CustomLogin)
  @HttpCode(200)
  async submitOrder(@Param('orderId') orderId: number) {
    return await this.selectionService.submitOrder(orderId);
  }
}
