import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { Role } from './auth/entities/role.entity';
import { Permission } from './auth/entities/permissions.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { LoginGuard } from './common/login.guard';
import { PermissionGuard } from './common/permission.guard';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { PermissionScanService } from './common/permission-scan.service';
import { PermissionModule } from './permission/permission.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Permission]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['src/.env.development'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory(configService: ConfigService) {
        return {
          type: 'mysql',
          host: configService.get('mysql_server_host'),
          port: configService.get('mysql_server_port'),
          username: configService.get('mysql_server_login_username'),
          password: configService.get('mysql_server_login_password'),
          database: configService.get('mysql_server_database'),
          synchronize: true,
          logging: true,
          entities: [User, Role, Permission],
          poolSize: 10,
          connectorPackage: 'mysql2',
          extra: {
            authPlugin: 'sha256_password',
          },
        };
      },
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory(configService: ConfigService) {
        return {
          secret: configService.get('jwt_secret'),
          signOptions: {
            expiresIn: '30m',
          },
        };
      },
      inject: [ConfigService],
    }),
    UserModule,
    RoleModule,
    PermissionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: LoginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    PermissionScanService,
  ],
})
export class AppModule {}
