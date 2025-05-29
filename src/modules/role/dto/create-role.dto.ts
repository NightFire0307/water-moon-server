import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateRoleDto {

  @IsNotEmpty({
    message: '角色编码不能为空',
  })
  @IsString()
  code: string

  @IsNotEmpty({
    message: '角色名称不能为空',
  })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  permissionIds: number[];
}
