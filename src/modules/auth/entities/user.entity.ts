import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../role/entities/role.entity';
import { Exclude } from 'class-transformer';

@Entity({
  name: 'users',
})
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({
    length: 50,
    comment: '用户名',
  })
  username: string;

  @Column({
    name: 'nick_name',
    length: 50,
    comment: '昵称',
  })
  nickname: string;

  @Column({
    name: 'phone',
    length: 11,
    comment: '手机号',
  })
  phone: string;

  @Column({
    length: 150,
    comment: '密码',
  })
  @Exclude()
  password: string;

  @Column({
    comment: '是否是管理员',
    default: false,
  })
  isAdmin: boolean;

  @Column({
    comment: '是否冻结',
    default: false,
  })
  isFrozen: boolean;

  @Column({ default: false, comment: '是否删除' })
  @Exclude()
  isDelete: boolean;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_roles',
  })
  roles: Role[];
}
