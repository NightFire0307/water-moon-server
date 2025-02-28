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
import { SelectionDto } from './dto/selection.dto';
import { Response } from 'express';
import { SelectTokenGuard } from '../common/select-token.guard';
import { OrderInfo } from '../common/custom.decorator';

@Controller('selection')
export class SelectionController {
  constructor(private readonly selectionService: SelectionService) {}

  @Post('login')
  async validateSelection(
    @Body() selectionDto: SelectionDto,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const orderId = this.selectionService.decodeOrderId(selectionDto.short_url);
    if (isNaN(Number(orderId))) throw new BadRequestException('无效的短链');

    const { access_token, refresh_token } =
      await this.selectionService.validateLinkAndPassword(
        +orderId,
        selectionDto,
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

  @Get('products')
  @UseGuards(SelectTokenGuard)
  async getSelectedProducts(@OrderInfo('orderId') orderId: number) {
    return await this.selectionService.getSelectedProducts(orderId);
  }
}
