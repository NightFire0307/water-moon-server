import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { Exclude } from 'class-transformer';

export enum LinkStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
}

@Entity('links')
export class Link {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  short_url: string;

  // 动态链接密码
  @Column()
  password: string;

  @ManyToOne(() => Order, (order) => order.links)
  @JoinColumn({ name: 'order_id' })
  @Exclude()
  order: Order;

  @Column()
  status: LinkStatus;

  @Column()
  created_by: number;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  expired_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
