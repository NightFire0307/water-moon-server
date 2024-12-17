import { Controller, Get, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
} from '../common/custom.decorator';

@Controller('admin/product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequireLogin()
  getProducts(
    @Pagination() pagination: PaginationQuery,
    @Query('name') name?: string,
  ) {
    return this.productService.getProducts(pagination, name);
  }
}
