import { Test, TestingModule } from '@nestjs/testing';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto } from './dto/update-role.dto';

describe('RoleController', () => {
  let controller: RoleController;
  let service: RoleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [
        {
          provide: RoleService,
          useValue: {
            getRoles: jest.fn(),
            createRole: jest.fn(),
            updateRolePermissions: jest.fn(),
            removeRole: jest.fn(),
            updateRole: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RoleController>(RoleController);
    service = module.get<RoleService>(RoleService);
  });

  it('控制器定义', () => {
    expect(controller).toBeDefined();
  });

  it('获取角色列表', async () => {
    const paginationQuery = { current: 1, pageSize: 10 };
    await controller.getRoles(paginationQuery);
    expect(service.getRoles).toHaveBeenCalledWith(paginationQuery);
  });

  it('创建角色', async () => {
    const createRoleDto: CreateRoleDto = { name: 'Admin' };
    await controller.createRole(createRoleDto);
    expect(service.createRole).toHaveBeenCalledWith(createRoleDto);
  });

  it('更新角色Permission', async () => {
    const id = '1';
    const updateRolePermissionsDto: UpdateRolePermissionsDto = {
      permissionsIds: [3, 4, 5],
    };
    await controller.updateRolePermissions(id, updateRolePermissionsDto);
    expect(service.updateRolePermissions).toHaveBeenCalledWith(
      +id,
      updateRolePermissionsDto,
    );
  });

  it('删除角色', async () => {
    const id = '1';
    await controller.deleteRole(id);
    expect(service.removeRole).toHaveBeenCalledWith(+id);
  });

  it('更新角色', async () => {
    const id = '1';
    const updateRoleDto: UpdateRoleDto = { name: 'User' };
    await controller.updateRole(id, updateRoleDto);
    expect(service.updateRole).toHaveBeenCalledWith(+id, updateRoleDto);
  });
});
