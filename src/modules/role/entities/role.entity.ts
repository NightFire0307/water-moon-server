import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from '../../auth/entities/permissions.entity';
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

  @Column({
    length: 255,
    comment: '角色描述',
  })
  description: string;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permissions',
  })
  permissions: Permission[];

  @CreateDateColumn()
  @Exclude()
  created_at: Date;

  @UpdateDateColumn()
  @Exclude()
  updated_at: Date;
}
