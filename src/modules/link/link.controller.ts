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
@RequirePermission({
  code: 'link',
  name: '链接管理',
  type: 'group',
  description: '链接管理',
})
export class LinkController {
  constructor(private readonly linkService: LinkService) { }

  @Post()
  @UseInterceptors(ClassSerializerInterceptor)
  @RequireLogin()
  @RequirePermission({
    code: 'link:create',
    name: '创建链接',
    type: 'button',
    description: '创建链接',
  })
  generateShareUrl(@Body() createLinkDto: CreateLinkDto) {
    return this.linkService.generateShareUrl(createLinkDto);
  }

  @Get('/:orderId')
  @RequireLogin()
  @RequirePermission({
    code: 'link:view',
    name: '查看链接',
    type: 'button',
    description: '查看链接',
  })
  getShareUrlByOrderId(
    @Param('orderId') orderId: string,
    @Pagination() pagination: PaginationQuery,
  ) {
    return this.linkService.getShareUrlByOrderId(+orderId, pagination);
  }

  @Delete('/:id')
  @RequireLogin()
  @RequirePermission({
    code: 'link:delete',
    name: '删除链接',
    type: 'button',
    description: '删除链接',
  })
  removeShareLink(@Param('id') id: string) {
    return this.linkService.removeShareLinkByOrderId(+id);
  }
}
