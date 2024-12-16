import { CreateRoleDto } from './create-role.dto';

export class UpdateRoleDto extends CreateRoleDto {}

export class UpdateRolePermissionsDto {
  id: number;
  permissionsIds: number[];
}
