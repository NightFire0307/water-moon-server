import { IsNotEmpty, MinLength } from 'class-validator';

export class UpdateUserPasswordDto {
  @IsNotEmpty({
    message: '新密码不能为空',
  })
  @MinLength(6, {
    message: '密码最短不能少于6位',
  })
  password: string;
}
