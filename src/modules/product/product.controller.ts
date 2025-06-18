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
  RequirePermission,
} from '../../common/custom.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductTypeDto } from './dto/create-productType.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductTypeDto } from './dto/update-productType.dto';
import { BatchDeleteProductType } from './dto/batch-delete-productType.dto';

@Controller('admin/product')
@RequirePermission({
  code: 'product',
  name: '产品管理',
  type: 'group',
  description: '产品管理'
})
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Get()
  @RequireLogin()
  @RequirePermission({
    code: 'product:view',
    name: '查看产品',
    type: 'button',
    description: '查看产品列表',
  })
  getProducts(
    @Pagination() pagination: PaginationQuery,
    @Query('name') name?: string,
    @Query('productTypeId') productTypeId?: string,
  ) {
    return this.productService.getProducts(pagination, name, productTypeId);
  }

  @Get('by-category')
  @RequireLogin()
  getProductByCategory(
    @Query('limit') limit: number = 10,
  ) {
    return this.productService.getProductByCategory(limit);
  }

  @Post()
  @RequireLogin()
  @RequirePermission({
    code: 'product:create',
    name: '添加产品',
    type: 'button',
    description: '添加产品',
  })
  async createProduct(@Body() createProductDto: CreateProductDto) {
    return await this.productService.createProduct(createProductDto);
  }

  @Put('/type/:id')
  @RequireLogin()
  @RequirePermission({
    code: 'product:update',
    name: '修改产品',
    type: 'button',
    description: '修改产品',
  })
  async updateProductType(
    @Param('id') id: string,
    @Body() updateProductType: UpdateProductTypeDto,
  ) {
    return await this.productService.updateProductType(+id, updateProductType);
  }

  @Get('/type')
  @RequireLogin()
  @RequirePermission({
    code: 'product-type:view',
    name: '查看产品类型',
    type: 'button',
    description: '查看产品类型列表',
  })
  async getProductTypes(
    @Pagination() pagination: PaginationQuery,
    @Query('name') name?: string,
  ) {
    return this.productService.getProductTypes(pagination, name);
  }

  @Get('/type/:id')
  @RequireLogin()
  @RequirePermission({
    code: 'product-type:view',
    name: '查看产品类型',
    type: 'button',
    description: '查看产品类型详情',
  })
  getProductTypeDetail(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      return 'id 必须为数字';
    }
    return this.productService.getProductTypeDetail(+id);
  }

  @Post('/type')
  @RequireLogin()
  @RequirePermission({
    code: 'product-type:create',
    name: '添加产品类型',
    type: 'button',
    description: '添加产品类型',
  })
  async createProductType(@Body() createProductTypeDto: CreateProductTypeDto) {
    return await this.productService.createProductType(createProductTypeDto);
  }

  @Delete('/type/:id')
  @RequireLogin()
  @RequirePermission({
    code: 'product-type:delete',
    name: '删除产品类型',
    type: 'button',
    description: '删除产品类型',
  })
  async deleteProductType(@Param('id') id: string) {
    return await this.productService.deleteProductType(+id);
  }

  @Delete('/type')
  @RequireLogin()
  @RequirePermission({
    code: 'product-type:delete',
    name: '批量删除产品类型',
    type: 'button',
    description: '批量删除产品类型',
  })
  batchDeleteProductType(@Body() body: BatchDeleteProductType) {
    return this.productService.batchDeleteProductType(body.ids);
  }

  @Get(':id')
  @RequireLogin()
  @RequirePermission({
    code: 'product:view',
    name: '产品详情',
    type: 'button',
    description: '查看产品详情',
  })
  getProductDetail(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      return 'id 必须为数字';
    }
    return this.productService.getProductDetail(+id);
  }

  @Put(':id')
  @RequireLogin()
  @RequirePermission({
    code: 'product:update',
    name: '修改产品',
    type: 'button',
    description: '修改产品',
  })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return await this.productService.updateProduct(+id, updateProductDto);
  }

  @Delete(':id')
  @RequireLogin()
  @RequirePermission({
    code: 'product:delete',
    name: '删除产品',
    type: 'button',
    description: '删除产品',
  })
  async deleteProduct(@Param('id') id: string) {
    if (Number.isNaN(+id)) {
      return 'id 必须为数字';
    }
    return await this.productService.deleteProduct(+id);
  }
}
