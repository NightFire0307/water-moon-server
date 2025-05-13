import { Role } from '../../role/entities/role.entity';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({
    message: '用户名不能为空',
  })
  @IsString()
  username: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  @Length(11, 11, { message: '手机号长度必须为11位' })
  phoneNumber: string;

  @IsString()
  @IsOptional()
  nickname: string;

  @IsNotEmpty({
    message: '密码不能为空',
  })
  @MinLength(6, {
    message: '密码不能少于6位',
  })
  password: string;

  @IsBoolean()
  @IsNotEmpty({
    message: '是否管理员参数不能为空',
  })
  isAdmin: boolean;

  @IsBoolean()
  @IsNotEmpty({
    message: '是否冻结参数不能为空',
  })
  isFrozen: boolean;

  roles: Role[];
}
