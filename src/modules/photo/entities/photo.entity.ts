import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Order } from '@/modules/order/entities/order.entity';
import { OrderProductPhoto } from '@/modules/order/entities/orderProductPhotos.entity';

export enum PreSelectStatus {
  PENDING = 'pending',
  SELECTED = 'selected',
  EXCLUDED = 'excluded',
}

@Entity('photos')
export class Photo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // 照片名称

  @Column({ name: 'oss_file_key' })
  ossFileKey: string; // OSS存储的文件键

  @Column()
  size: number;

  // 订单关联照片
  @ManyToOne(() => Order, (order) => order.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  // 产品关联照片
  @OneToMany(
    () => OrderProductPhoto,
    (op) => op.photo,
    { cascade: true }
  )
  orderProductPhotos: OrderProductPhoto[];

  @Column({
    name: 'pre_select_status',
    type: 'enum',
    enum: PreSelectStatus,
    default: PreSelectStatus.PENDING,
  })
  preSelectStatus: PreSelectStatus; // 预选状态

  @Column({ name: 'is_recommended', default: false })
  isRecommended: boolean; // 是否推荐

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean; // 是否删除

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
