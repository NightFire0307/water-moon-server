import { Injectable } from '@nestjs/common';
import { CreatePackageDto } from './dto/createPackage.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductPackage } from './entities/product-package.entity';
import { ProductPackageItem } from './entities/product-package-item.entity';
import { Product } from '../product/entities/product.entity';
import { In, Repository } from 'typeorm';
import { CommonErrorCode, DatabaseException } from '@/common/exceptions/database.exception';
import type { PaginationQuery } from '@/common/decorators/pagination.decorator';
import type { UpdatePackageDto } from './dto/updatePackage.dto';
import type { QueryPackageDto } from './dto/queryPackage.dto';

@Injectable()
export class PackageService {

  @InjectRepository(ProductPackage)
  private readonly packageRepository: Repository<ProductPackage>;

  @InjectRepository(ProductPackageItem)
  private readonly packageItemRepository: Repository<ProductPackageItem>;

  @InjectRepository(Product)
  private readonly productRepository: Repository<Product>;

  async getPackages(pagination: PaginationQuery, { is_published = true, name }: QueryPackageDto) {
    console.log(is_published)
    const queryBuilder = this.packageRepository.createQueryBuilder('package')
      .leftJoinAndSelect('package.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.product_type', 'productType')
      .where('package.is_published = :is_published', { is_published });

    if (name) {
      queryBuilder.andWhere('package.name LIKE :name', { name: `%${name}%` });
    }

    queryBuilder
      .take(pagination.pageSize)
      .skip((pagination.current - 1) * pagination.pageSize);

    const data = await queryBuilder.getMany();

    return {
      data: {
        list: data.map(pkg => ({
          ...pkg,
          items: pkg.items.map(item => ({
            id: item.id,
            count: item.count,
            product: {
              id: item.product.id,
              name: item.product.name,
              is_published: item.product.is_published,
              photo_limit: item.product.photo_limit,
            },
            product_type: item.product.product_type.name,
          }))
        })),
        total: await queryBuilder.getCount(),
        current: pagination.current,
        pageSize: pagination.pageSize,
      },
      msg: '获取套餐列表成功',
    }
  }

  async getPackageById(id: number) {
    const pkg = await this.packageRepository.createQueryBuilder('package')
      .leftJoinAndSelect('package.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.product_type', 'productType')
      .where('package.id = :id', { id })
      .getOne()

    return {
      data: {
        ...pkg,
        items: pkg.items.map(item => ({
          id: item.id,
          count: item.count,
          category: item.product.product_type.name,
          product: {
            productId: item.product.id,
            name: item.product.name,
            is_published: item.product.is_published,
            photo_limit: item.product.photo_limit,
          }
        }))
      },
      msg: '获取套餐详情成功',
    }
  }

  async createPackage({ items, name, isPublished, price, description }: CreatePackageDto) {
    const productIds = items.map(item => item.productId);

    try {
      const products = await this.validateProductsExist(productIds);

      const productPackageItems: ProductPackageItem[] = []
      for (const product of products) {
        const item = new ProductPackageItem();
        item.product = product;
        item.count = items.find(i => i.productId === product.id)?.count || 1;
        productPackageItems.push(item);
      }

      const productPackageItemResult = await this.packageItemRepository.save(productPackageItems);

      const productPackage = await this.packageRepository.create({
        name,
        description,
        price,
        is_published: isPublished,
        items: productPackageItemResult,
      })

      const data = await this.packageRepository.save(productPackage);

      return {
        data,
        msg: '套餐创建成功',
      }
    } catch (e) {
      console.error('创建套餐失败:', e);
      throw new DatabaseException(CommonErrorCode.DATABASE_ERROR, '创建套餐失败');
    }
  }

  async updatePackage(id: number, { items, name, isPublished, price, description }: UpdatePackageDto) {
    const pkg = await this.validatePackageExist(id);

    if (!Array.isArray(items) || items.length === 0) {
      throw new DatabaseException(CommonErrorCode.DATABASE_ERROR, '套餐内必须包含至少一个商品');
    }

    const productIds = items.map(item => item.productId);
    const products = await this.validateProductsExist(productIds)

    // 清空旧的套餐项
    await this.packageItemRepository.delete({ package: { id } });

    // 创建新的套餐项
    const productPackageItems: ProductPackageItem[] = []
    for (const product of products) {
      const item = new ProductPackageItem();
      item.product = product;
      item.count = items.find(i => i.productId === product.id)?.count || 1;
      productPackageItems.push(item);
    }

    const productPackageItemResult = await this.packageItemRepository.save(productPackageItems);

    // 更新套餐信息
    pkg.name = name;
    pkg.description = description;
    pkg.price = price;
    pkg.is_published = isPublished;
    pkg.items = productPackageItemResult;

    const updatePkg = await this.packageRepository.save(pkg);

    return {
      data: updatePkg,
      msg: '套餐更新成功',
    }
  }

  async deletePackage(id: number) {
    const pkg = await this.validatePackageExist(id);

    await this.packageRepository.remove(pkg);
    return {
      data: id,
      msg: '套餐删除成功',
    }
  }

  // 校验套餐是否存在
  private async validatePackageExist(id: number) {
    const pkg = await this.packageRepository.findOne({
      where: { id },
      relations: ['items', 'items.product']
    })

    if (!pkg) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '套餐不存在');
    }

    return pkg;
  }

  // 校验产品是否存在
  private async validateProductsExist(productIds: number[]) {
    const products = await this.productRepository.find({
      where: {
        id: In(productIds),
        is_published: true,
      }
    });

    if (productIds.length !== products.length) {
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '部分商品不存在或未上架');
    }

    return products
  }
}
