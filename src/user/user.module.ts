import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Role } from '../auth/entities/role.entity';
import { Permission } from '../auth/entities/permissions.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission])],
  controllers: [AuthController],
  providers: [UserService],
})
export class UserModule {}
