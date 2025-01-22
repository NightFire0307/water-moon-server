import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ClassSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { LinkService } from './link.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { Pagination, PaginationQuery } from '../common/custom.decorator';

@Controller('/admin/order/link')
export class LinkController {
  constructor(private readonly linkService: LinkService) {}

  @Post()
  @UseInterceptors(ClassSerializerInterceptor)
  generateShareUrl(@Body() createLinkDto: CreateLinkDto) {
    return this.linkService.generateShareUrl(createLinkDto);
  }

  @Get()
  findAll(@Pagination() pagination: PaginationQuery) {
    return this.linkService.findAll(pagination);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.linkService.remove(+id);
  }
}
