import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../auth/entities/permissions.entity';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission]), RedisModule],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule { }
