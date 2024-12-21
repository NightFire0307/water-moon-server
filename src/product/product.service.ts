import { Injectable } from '@nestjs/common';
import { ProductType } from './entities/productType.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Like, QueryFailedError, Repository } from 'typeorm';
import { PaginationQuery } from '../common/custom.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductTypeDto } from './dto/create-productType.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductTypeDto } from './dto/update-productType.dto';
import { DatabaseException } from '../common/database-exception.filter';
import { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';

@Injectable()
export class ProductService {
  @InjectRepository(ProductType)
  private readonly productTypeRepository: Repository<ProductType>;

  @InjectRepository(Product)
  private readonly productRepository: Repository<Product>;

  async init_db() {
    const product = new Product();
    const productType = new ProductType();

    productType.name = 'test_productType';
    product.name = 'test_product';

    product.type = productType;

    await this.productTypeRepository.save(productType);
    await this.productRepository.save(product);

    return 'done';
  }

  async getProducts(pagination: PaginationQuery, name?: string) {
    const [list, total] = await this.productRepository.findAndCount({
      where: name ? { name: Like(`%${name}%`) } : {},
      skip: (pagination.current - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });

    return {
      list,
      total,
      ...pagination,
    };
  }

  async createProduct(createProductDto: CreateProductDto) {
    const product = new Product();
    product.name = createProductDto.name;
    product.type = await this.productTypeRepository.findOne({
      where: {
        id: createProductDto.type,
      },
    });

    if (!product.type) return '产品类型不存在';
    return this.productRepository.save(product);
  }

  async updateProduct(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
    });

    if (!product) return '产品不存在';

    product.name = updateProductDto.name;
    product.type = await this.productTypeRepository.findOne({
      where: {
        id: updateProductDto.type,
      },
    });

    if (!product.type) return '产品类型不存在';
    await this.productRepository.save(product);
    return '修改成功';
  }

  async deleteProduct(id: number) {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
    });

    if (!product) return '产品不存在';

    await this.productRepository.remove(product);
    return '删除成功';
  }

  async getProductTypes(pagination: PaginationQuery) {
    const [list, total] = await this.productTypeRepository.findAndCount({
      skip: (pagination.current - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });

    return {
      list,
      total,
      ...pagination,
    };
  }

  async getProductTypeDetail(id: number) {
    const productType = await this.productTypeRepository.findOne({
      where: {
        id,
      },
    });

    if (!productType) return '产品类型不存在';
    return {
      data: productType,
      message: '查询成功',
    };
  }

  async createProductType(createProductTypeDto: CreateProductTypeDto) {
    const foundProductType = await this.productTypeRepository.findOneBy({
      name: createProductTypeDto.name,
    });

    if (foundProductType) return '产品类型已存在';

    try {
      const productType = new ProductType();
      productType.name = createProductTypeDto.name;
      const data = await this.productTypeRepository.save(productType);
      return { data, message: '创建成功' };
    } catch (e) {
      return e;
    }
  }

  async updateProductType(id: number, updateProductType: UpdateProductTypeDto) {
    const productType = await this.productTypeRepository.findOne({
      where: {
        id,
      },
    });

    if (!productType) return '产品类型不存在';

    productType.name = updateProductType.name;
    try {
      const data = await this.productTypeRepository.save(productType);
      return { data, message: '修改成功' };
    } catch (e) {
      throw new DatabaseException(e);
    }
  }

  async deleteProductType(id: number) {
    const productType = await this.productTypeRepository.findOne({
      where: {
        id,
      },
    });

    if (!productType) return '产品类型不存在';

    await this.productTypeRepository.remove(productType);
    return '删除成功';
  }
}
