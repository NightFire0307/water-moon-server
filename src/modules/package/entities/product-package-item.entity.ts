import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ProductPackage } from './product-package.entity';
import { Product } from '@/modules/product/entities/product.entity';

@Entity('product_package_items')
export class ProductPackageItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductPackage, pkg => pkg.items, { onDelete: 'CASCADE' })
  package: ProductPackage;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @Column({ type: 'int', default: 1, comment: '产品数量' })
  count: number;
}
