import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { Response } from 'express';
import { OrderInfo } from '../common/custom.decorator';
import { ValidLinkAndToken } from './validLinkAndToken.guard';

@Controller('selection')
export class SelectionController {
  constructor(private readonly selectionService: SelectionService) {}

  // 校验短链和密码
  @Post('validate')
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
    });
    return {
      data: {
        access_token,
      },
    };
  }

  @Get('products/:short_url')
  @UseGuards(ValidLinkAndToken)
  async getSelectedProducts(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getSelectedProducts(orderId);
  }

  @Get('photos/:short_url')
  @UseGuards(ValidLinkAndToken)
  async getSelectedPhotos(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getSelectedPhotos(orderId);
  }

  // 更新照片选择
  @Put('photos/:short_url')
  updateSelectedPhotos() {}

  // 提交选片结果
  @Post('submit/:short_url')
  submitSelection() {}
}
