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
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
  RequirePermission,
} from '../../common/custom.decorator';

@Controller('admin/order/link')
export class LinkController {
  constructor(private readonly linkService: LinkService) { }

  @Post()
  @UseInterceptors(ClassSerializerInterceptor)
  @RequireLogin()
  @RequirePermission('link:create', '生成分享链接')
  generateShareUrl(@Body() createLinkDto: CreateLinkDto) {
    return this.linkService.generateShareUrl(createLinkDto);
  }

  @Get('/:orderId')
  @RequireLogin()
  @RequirePermission('link:list', '获取分享链接')
  getShareUrlByOrderId(
    @Param('orderId') orderId: string,
    @Pagination() pagination: PaginationQuery,
  ) {
    return this.linkService.getShareUrlByOrderId(+orderId, pagination);
  }

  @Delete('/:id')
  @RequireLogin()
  @RequirePermission('link:delete', '删除分享链接')
  removeShareLink(@Param('id') id: string) {
    return this.linkService.removeShareLinkByOrderId(+id);
  }
}
