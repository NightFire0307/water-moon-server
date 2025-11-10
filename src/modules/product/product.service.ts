import { ConflictException, HttpStatus, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ProductType } from './entities/productType.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { In, Like, Repository } from 'typeorm';
import { PaginationQuery } from '@/common/decorators/pagination.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductTypeDto } from './dto/create-productType.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductTypeDto } from './dto/update-productType.dto';
import { ProductException, ProductErrorCode } from '@/common/exceptions/product.exception';


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

    const reducedList = list.reduce((acc, cur) => {
      return [
        ...acc,
        {
          id: cur.id,
          name: cur.name,
          photoLimit: cur.photo_limit,
          isPublished: cur.is_published,
          type: cur.product_type.name,
          createdAt: cur.createdAt,
        },
      ];
    }, []);

    return {
      list: reducedList,
      total,
      ...pagination,
    }
  }

  async getProductDetail(id: number) {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
      relations: ['product_type'],
    });

    if (!product) return '产品不存在';
    return product
  }

  async createProduct(createProductDto: CreateProductDto) {
    const product = new Product();
    product.name = createProductDto.name;
    product.is_published = createProductDto.isPublished;
    product.photo_limit = createProductDto.photoLimit;
    product.product_type = await this.productTypeRepository.findOne({
      where: {
        id: createProductDto.productTypeId,
      },
    });

    if (!product.product_type) return '产品类型不存在';
    const data = await this.productRepository.save(product);
    return {
      data,
      msg: '创建成功',
    };
  }

  async updateProduct(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
    });

    if (!product) return '产品不存在';

    product.name = updateProductDto.name;
    product.is_published = updateProductDto.isPublished;
    product.photo_limit = updateProductDto.photoLimit;
    product.product_type = await this.productTypeRepository.findOne({
      where: {
        id: updateProductDto.productTypeId,
      },
    });

    if (!product.product_type) return '产品类型不存在';

    try {
      await this.productRepository.save(product);
      return '修改成功'
    } catch (e) {
      throw new ProductException(ProductErrorCode.PRODUCT_UPDATE_FAILED, null, HttpStatus.CONFLICT);
    }
  }

  async deleteProduct(id: number) {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
    });

    if (!product)
      throw new ProductException(ProductErrorCode.PRODUCT_NOT_FOUND, null, HttpStatus.NOT_FOUND);

    await this.productRepository.remove(product);
    return { data: product.id, message: '删除成功' };
  }

  async getProductTypes(pagination: PaginationQuery, name?: string) {
    const whereCondition = name ? { name: Like(`%${name}%`) } : {};
    const [list, total] = await this.productTypeRepository.findAndCount({
      where: whereCondition,
      skip: (pagination.current - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });

    return {
      list,
      total,
      ...pagination,
    }
  }

  async getProductTypeDetail(id: number) {
    const productType = await this.productTypeRepository.findOne({
      where: {
        id,
      },
    });

    if (!productType) return '产品类型不存在';
    return productType;
  }

  async createProductType(createProductTypeDto: CreateProductTypeDto) {
    const foundProductType = await this.productTypeRepository.findOneBy({
      name: createProductTypeDto.name,
    });

    if (foundProductType)
      throw new ProductException(ProductErrorCode.PRODUCT_TYPE_INVALID, null, HttpStatus.CONFLICT);

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
      throw new NotFoundException('产品类型不存在');

    productType.name = updateProductType.name;
    try {
      const data = await this.productTypeRepository.save(productType);
      return { data, message: '修改成功' };
    } catch (e) {
      throw new InternalServerErrorException('产品类型更新失败');
    }
  }

  async deleteProductType(id: number) {
    const productType = await this.productTypeRepository.findOne({
      where: {
        id,
      },
    });

    if (!productType)
      throw new NotFoundException('产品类型不存在');

    try {
      await this.productTypeRepository.remove(productType);
      return '删除成功';
    } catch (e) {
      throw new ConflictException('请先删除对应产品');
    }
  }

  async batchDeleteProductType(ids: number[]) {
    const productTypes = await this.productTypeRepository.find({
      where: {
        id: In(ids),
      },
    });

    if (productTypes.length !== ids.length) {
      throw new NotFoundException('部分产品类型不存在');
    }

    await this.productTypeRepository.remove(productTypes);
    return {
      data: ids,
      message: '删除成功',
    };
  }

  async getProductByCategory(keyword: string, limit: number = 10) {

    const products = await this.productTypeRepository
      .createQueryBuilder('productType')
      .leftJoinAndSelect('productType.products', 'product', 'product.is_published = :isPublished', { isPublished: true })
      .where(
        '(productType.name LIKE :keyword OR product.name LIKE :keyword)',
        { keyword: `%${keyword}%` }
      )
      .select([
        'productType.id',
        'productType.name',
        'product.id AS productId',
        'product.name'
      ])
      .cache(60)
      .getRawMany();


    console.log(products)
    // 转换为 Map 以便按产品类型分组
    const map = new Map<number, { id: number, category: string, items: Record<string, any> }>()
    for (const product of products) {
      if (!map.has(product.productType_id)) {
        map.set(product.productType_id, {
          id: product.productType_id,
          category: product.productType_name,
          items: []
        });
      }

      if (product.productId) {
        map.get(product.productType_id).items.push({
          productId: product.productId,
          name: product.product_name,
        });
      }
    }

    return Array.from(map.values())
  }
}
