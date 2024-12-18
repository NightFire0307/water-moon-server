import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
} from '../common/custom.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductTypeDto } from './dto/create-productType.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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

  @Post()
  @RequireLogin()
  async createProduct(@Body() createProductDto: CreateProductDto) {
    return await this.productService.createProduct(createProductDto);
  }

  @Put(':id')
  @RequireLogin()
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return await this.productService.updateProduct(+id, updateProductDto);
  }

  @Get('/type')
  @RequireLogin()
  async getProductTypes(@Pagination() pagination: PaginationQuery) {
    return this.productService.getProductTypes(pagination);
  }

  @Post('/type')
  @RequireLogin()
  async createProductType(@Body() createProductTypeDto: CreateProductTypeDto) {
    return await this.productService.createProductType(createProductTypeDto);
  }

  @Put('/type/:id')
  @RequireLogin()
  async updateProductType(
    @Param('id') id: string,
    @Body() createProductTypeDto: CreateProductTypeDto,
  ) {
    return await this.productService.updateProductType(
      +id,
      createProductTypeDto,
    );
  }
}
