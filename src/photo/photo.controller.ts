import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
} from '@nestjs/common';
import { PhotoService } from './photo.service';
import { RequireLogin } from '../common/custom.decorator';
import { CreatePhotosDto } from './dto/create-photos.dto';

@Controller('/admin/photos')
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Post(':orderId')
  @RequireLogin()
  async createPhoto(
    @Param('orderId') orderId: string,
    @Body() createPhotosDto: CreatePhotosDto,
  ) {
    if (Number.isNaN(+orderId)) {
      throw new BadRequestException('订单ID必须是数字');
    }
    return this.photoService.createPhoto(+orderId, createPhotosDto);
  }
}
