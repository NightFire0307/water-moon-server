import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { Response } from 'express';
import { SelectTokenGuard } from '../common/select-token.guard';
import { OrderInfo } from '../common/custom.decorator';

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

  @Get(':short_url')
  @UseGuards(SelectTokenGuard)
  async getSelectedProducts(
    @Param('short_url') short_url: string,
    @OrderInfo('orderId') orderId: number,
  ) {
    this.validateShortUrl(short_url, orderId);

    return await this.selectionService.getSelectedProducts(orderId);
  }

  @Get('photos/:short_url')
  @UseGuards(SelectTokenGuard)
  async getSelectedPhotos(
    @Param('short_url') short_url: string,
    @OrderInfo('orderId') orderId: number,
  ) {
    this.validateShortUrl(short_url, orderId);
    return await this.selectionService.getSelectedPhotos(orderId);
  }

  // 校验短链和订单号是否匹配
  private validateShortUrl(short_url: string, orderId: number) {
    const decodedOrderId = this.selectionService.decodeOrderId(short_url);
    if (decodedOrderId !== orderId.toString()) {
      throw new BadRequestException('无效的短链');
    }
  }

  // 更新照片选择
  @Put('photos/:short_url')
  @UseGuards(SelectTokenGuard)
  updateSelectedPhotos() {}

  // 提交选片结果
  @Post('submit/:short_url')
  @UseGuards(SelectTokenGuard)
  submitSelection() {}
}
