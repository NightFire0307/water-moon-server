import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ProductService } from './product.service';
import {
  Pagination,
  PaginationQuery,
  RequireLogin,
} from '../common/custom.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductTypeDto } from './dto/create-productType.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductTypeDto } from './dto/update-productType.dto';

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

  @Put('/type/:id')
  @RequireLogin()
  async updateProductType(
    @Param('id') id: string,
    @Body() updateProductType: UpdateProductTypeDto,
  ) {
    return await this.productService.updateProductType(+id, updateProductType);
  }

  @Get('/type')
  @RequireLogin()
  async getProductTypes(@Pagination() pagination: PaginationQuery) {
    return this.productService.getProductTypes(pagination);
  }

  @Get('/type/:id')
  @RequireLogin()
  getProductTypeDetail(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      return 'id 必须为数字';
    }
    return this.productService.getProductTypeDetail(+id);
  }

  @Post('/type')
  @RequireLogin()
  async createProductType(@Body() createProductTypeDto: CreateProductTypeDto) {
    return await this.productService.createProductType(createProductTypeDto);
  }

  @Delete('/type/:id')
  @RequireLogin()
  async deleteProductType(@Param('id') id: string) {
    return await this.productService.deleteProductType(+id);
  }

  @Get(':id')
  @RequireLogin()
  getProductDetail(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      return 'id 必须为数字';
    }
    return this.productService.getProductDetail(+id);
  }

  @Put(':id')
  @RequireLogin()
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return await this.productService.updateProduct(+id, updateProductDto);
  }

  @Delete(':id')
  @RequireLogin()
  async deleteProduct(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      return 'id 必须为数字';
    }
    return await this.productService.deleteProduct(+id);
  }
}
