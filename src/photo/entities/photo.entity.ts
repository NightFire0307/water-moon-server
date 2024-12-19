import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  ManyToMany,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { Product } from '../../product/entities/product.entity'; // 产品类型实体

@Entity('photos')
export class Photo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  oss_url: string; // 照片存储路径

  @ManyToOne(() => Order, (order) => order.photos)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToMany(() => Product, (product) => product.id, { nullable: true })
  marked_product: Product; // 标记制作的产品，可为空

  @Column({ default: false })
  is_selected: boolean; // 是否被选中

  @Column({ default: false })
  is_recommended: boolean; // 是否推荐

  @CreateDateColumn()
  uploaded_at: Date;
}
