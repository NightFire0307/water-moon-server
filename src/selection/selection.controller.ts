import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SelectionService } from './selection.service';
import { SelectionLoginDto } from './dto/selection-login.dto';
import { Response } from 'express';
import { SelectTokenGuard } from '../common/select-token.guard';
import { OrderInfo } from '../common/custom.decorator';
import { SelectionCheckLoginDto } from './dto/selection-check-login.dto';

@Controller('selection')
export class SelectionController {
  constructor(private readonly selectionService: SelectionService) {}

  @Post('login')
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

  @Post('check-login')
  @UseGuards(SelectTokenGuard)
  async checkLogin(@Body() checkLoginDto: SelectionCheckLoginDto) {
    const { short_url } = checkLoginDto;
    // TODO 校验短链是否有效
    this.selectionService.verifyShortUrl(short_url);
    return { data: 'ok' };
  }

  @Get('products')
  @UseGuards(SelectTokenGuard)
  async getSelectedProducts(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getSelectedProducts(orderId);
  }
}
