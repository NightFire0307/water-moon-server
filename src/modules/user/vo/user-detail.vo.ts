import type { User } from "@/modules/user/entities/user.entity";

export class UserDetailVo {
  id: number;
  username: string;
  nickname: string;
  phone: string;
  isFrozen: boolean;
  roles: {
    id: number
    name: string;
    code: string
  }[];
  createTime: Date;
  updateTime: Date;

  constructor(entity: Partial<User>) {
    this.id = entity.user_id;
    this.username = entity.username;
    this.nickname = entity.nickname;
    this.isFrozen = entity.isFrozen;
    this.phone = entity.phone
    this.roles = entity.roles.map(role => ({
      id: role.roleId,
      name: role.name,
      code: role.code,
    }))
    this.createTime = entity.createTime;
    this.updateTime = entity.updateTime;
  }
}
