import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ProductType } from '../../product/entities/productType.entity';
import { Order } from '../../order/entities/order.entity'; // 产品类型实体

@Entity('photos')
export class Photo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  oss_url: string; // 照片存储路径

  @ManyToOne(() => Order, (order) => order.photos)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => ProductType, { nullable: true })
  marked_product: ProductType; // 标记的产品类型，可为空

  @Column({ default: false })
  is_selected: boolean; // 是否被选中

  @Column({ default: false })
  is_recommended: boolean; // 是否推荐

  @CreateDateColumn()
  uploaded_at: Date;
}
