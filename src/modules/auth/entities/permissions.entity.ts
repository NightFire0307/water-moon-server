import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PermissionType {
  GROUP = 'group',
  BUTTON = 'button',
}

export enum PermissionAction {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  DELETE = 'delete',
}

@Entity({
  name: 'permissions',
})
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  code: string;

  @Column()
  name: string;

  @Column({
    nullable: true,
  })
  endpoint: string | null;

  @Column({
    nullable: true,
  })
  action: PermissionAction | null;

  @Column()
  type: PermissionType;

  @Column({
    length: 100,
    comment: '权限描述',
    default: '',
  })
  description: string;

  @Column({
    type: 'bigint',
    default: null,
    nullable: true,
    comment: '父级权限ID',
  })
  parentId: number | null;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;
}
