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

  @Column()
  oss_file_key: string; // OSS存储的文件键

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
    type: 'enum',
    enum: PreSelectStatus,
    default: PreSelectStatus.PENDING,
  })
  pre_select_status: PreSelectStatus; // 预选状态

  @Column({ default: false })
  is_recommended: boolean; // 是否推荐

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean; // 是否删除

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
