import { Injectable } from '@nestjs/common';

@Injectable()
export class RoleService {
  getRoles() {
    return 'Get roles';
  }

  createRole() {
    return 'Create role';
  }
}
