import { Role } from '../../role/entities/role.entity';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({
    message: '用户名不能为空',
  })
  @IsString()
  username: string;

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
