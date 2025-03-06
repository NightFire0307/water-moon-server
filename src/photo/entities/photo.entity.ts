import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { OrderProduct } from '../../order/entities/orderProduct.entity'; // 产品类型实体

@Entity('photos')
export class Photo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // 照片名称

  @Column()
  oss_file_key: string;

  @Column()
  size: number;

  // 订单关联照片
  @ManyToOne(() => Order, (order) => order.photos)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  // 产品关联照片
  @ManyToOne(() => OrderProduct, (orderProduct) => orderProduct.selected_photos)
  @JoinColumn({ name: 'order_product_id' })
  order_product: OrderProduct;

  @Column({ default: false })
  is_selected: boolean; // 是否被选中

  @Column({ default: false })
  is_recommended: boolean; // 是否推荐

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean; // 是否删除

  @Column({ default: '' })
  remark: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
