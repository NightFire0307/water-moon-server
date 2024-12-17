import { Injectable } from '@nestjs/common';
import { ProductType } from './entities/productType.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Like, Repository } from 'typeorm';
import { PaginationQuery } from '../common/custom.decorator';

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
}
