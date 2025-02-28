import { Injectable } from '@nestjs/common';
import { ProductType } from './entities/productType.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Like, Repository } from 'typeorm';
import { PaginationQuery } from '../common/custom.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductTypeDto } from './dto/create-productType.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductTypeDto } from './dto/update-productType.dto';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';

@Injectable()
export class ProductService {
  @InjectRepository(ProductType)
  private readonly productTypeRepository: Repository<ProductType>;

  @InjectRepository(Product)
  private readonly productRepository: Repository<Product>;

  async getProducts(
    pagination: PaginationQuery,
    name?: string,
    productTypeId?: string,
  ) {
    const whereCondition: any = {};
    if (name) whereCondition.name = Like(`%${name}%`);
    if (productTypeId) whereCondition.type = { id: productTypeId };

    const [list, total] = await this.productRepository.findAndCount({
      where: whereCondition,
      skip: (pagination.current - 1) * pagination.pageSize,
      take: pagination.pageSize,
      relations: ['product_type'],
    });

    return {
      data: {
        list,
        total,
        ...pagination,
      },
    };
  }

  async getProductDetail(id: number) {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
      relations: ['type'],
    });

    if (!product) return '产品不存在';
    return {
      data: product,
    };
  }

  async createProduct(createProductDto: CreateProductDto) {
    const product = new Product();
    product.name = createProductDto.name;
    product.product_type = await this.productTypeRepository.findOne({
      where: {
        id: createProductDto.productTypeId,
      },
    });

    if (!product.product_type) return '产品类型不存在';
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
    product.product_type = await this.productTypeRepository.findOne({
      where: {
        id: updateProductDto.productTypeId,
      },
    });

    if (!product.product_type) return '产品类型不存在';

    try {
      await this.productRepository.save(product);
      return { data: '', message: '修改成功' };
    } catch (e) {
      throw new DatabaseException(DatabaseErrorType.DEFAULT, e);
    }
  }

  async deleteProduct(id: number) {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
    });

    if (!product)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '数据不存在',
      );

    await this.productRepository.remove(product);
    return { data: '', message: '删除成功' };
  }

  async getProductTypes(pagination: PaginationQuery, name?: string) {
    const whereCondition = name ? { name: Like(`%${name}%`) } : {};
    const [list, total] = await this.productTypeRepository.findAndCount({
      where: whereCondition,
      skip: (pagination.current - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });

    return {
      data: {
        list,
        total,
        ...pagination,
      },
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
    };
  }

  async createProductType(createProductTypeDto: CreateProductTypeDto) {
    const foundProductType = await this.productTypeRepository.findOneBy({
      name: createProductTypeDto.name,
    });

    if (foundProductType)
      throw new DatabaseException(
        DatabaseErrorType.DATA_ALREADY_EXISTS,
        '数据已存在',
      );

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

    if (!productType)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '数据不存在',
      );

    productType.name = updateProductType.name;
    try {
      const data = await this.productTypeRepository.save(productType);
      return { data, message: '修改成功' };
    } catch (e) {
      throw new DatabaseException(DatabaseErrorType.DEFAULT, e);
    }
  }

  async deleteProductType(id: number) {
    const productType = await this.productTypeRepository.findOne({
      where: {
        id,
      },
    });

    if (!productType)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '数据不存在',
      );

    await this.productTypeRepository.remove(productType);
    return {
      data: '',
      message: '删除成功',
    };
  }
}
