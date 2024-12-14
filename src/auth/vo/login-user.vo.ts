export interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  isFrozen: boolean;
  isAdmin: boolean;
  createTime: string;
  updateTime: string;
  roles: string[];
  permissions: string[];
}

export class LoginUserVo {
  userinfo: UserInfo;
  accessToken: string;
  refreshToken: string;
}
