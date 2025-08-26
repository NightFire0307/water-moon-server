import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { User } from './modules/user/entities/user.entity';
import { Permission } from './modules/auth/entities/permissions.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { LoginGuard } from './common/guards/login.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionScanService } from './modules/auth/services/permission-scan.service';
import { PermissionModule } from './modules/permission/permission.module';
import { ProductModule } from './modules/product/product.module';
import { OrderModule } from './modules/order/order.module';
import { PhotoModule } from './modules/photo/photo.module';
import { LinkModule } from './modules/link/link.module';
import { RedisModule } from './redis/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MinioModule } from './minio/minio.module';
import { BullModule } from '@nestjs/bullmq';
import { SelectionModule } from './modules/selection/selection.module';
import * as path from 'path'
import { SeedModule } from './seeds/seed.module';
import { PackageModule } from '@/modules/package/package.module';
import { MinioService } from './minio/minio.service';
import { appDataSource } from 'data-source';

console.log(`Environment: ${process.env.NODE_ENV}`);

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Permission, User]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, `.env.${process.env.NODE_ENV}`),
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...appDataSource.options,
        autoLoadEntities: true,
      })
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
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    UserModule,
    RoleModule,
    PermissionModule,
    ProductModule,
    OrderModule,
    PhotoModule,
    LinkModule,
    RedisModule,
    MinioModule,
    SelectionModule,
    SeedModule,
    PackageModule,
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
    MinioService
  ],
})
export class AppModule { }
