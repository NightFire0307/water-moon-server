import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permissions.entity';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission])],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: 'MINIO_CLIENT',
      useFactory(configService: ConfigService) {
        return new Minio.Client({
          endPoint: configService.get('minio_endpoint'),
          port: configService.get('minio_port'),
          useSSL: false,
          accessKey: configService.get('minio_access_key'),
          secretKey: configService.get('minio_secret_key'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['MINIO_CLIENT'],
})
export class AuthModule {}
