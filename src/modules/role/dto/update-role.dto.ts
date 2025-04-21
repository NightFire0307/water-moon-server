import { CreateRoleDto } from './create-role.dto';

export class UpdateRoleDto extends CreateRoleDto {}

export class UpdateRolePermissionsDto {
  permissionsIds: number[];
}
