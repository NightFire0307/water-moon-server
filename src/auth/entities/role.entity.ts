import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from './permissions.entity';
import { Exclude } from 'class-transformer';

@Entity({
  name: 'roles',
})
export class Role {
  @PrimaryGeneratedColumn()
  role_id: number;

  @Column({
    length: 20,
    comment: '角色名',
  })
  name: string;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permissions',
  })
  permissions: Permission[];

  @CreateDateColumn()
  @Exclude()
  createTime: Date;

  @UpdateDateColumn()
  @Exclude()
  updateTime: Date;
}
