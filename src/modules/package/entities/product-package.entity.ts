import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProductPackageItem } from './product-package-item.entity';

@Entity('product_packages')
export class ProductPackage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, comment: '套餐名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '套餐描述' })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '套餐价格' })
  price: number;

  // 套餐是否上架
  @Column({ type: 'boolean', default: true, comment: '套餐是否上架' })
  is_published: boolean;

  @OneToMany(() => ProductPackageItem, item => item.package, { cascade: true })
  items: ProductPackageItem[];
}
