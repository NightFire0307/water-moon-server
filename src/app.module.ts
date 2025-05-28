import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { User } from './modules/auth/entities/user.entity';
import { Role } from './modules/role/entities/role.entity';
import { Permission } from './modules/auth/entities/permissions.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { LoginGuard } from './common/guard/login.guard';
import { PermissionGuard } from './common/guard/permission.guard';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionScanService } from './common/permission-scan.service';
import { PermissionModule } from './modules/permission/permission.module';
import { ProductModule } from './modules/product/product.module';
import { ProductType } from './modules/product/entities/productType.entity';
import { Product } from './modules/product/entities/product.entity';
import { OrderModule } from './modules/order/order.module';
import { PhotoModule } from './modules/photo/photo.module';
import { Order } from './modules/order/entities/order.entity';
import { Photo } from './modules/photo/entities/photo.entity';
import { OrderProduct } from './modules/order/entities/orderProduct.entity';
import { LinkModule } from './modules/link/link.module';
import { Link } from './modules/link/entities/link.entity';
import { MinioInitService } from './common/minio-init.service';
import { RedisModule } from './redis/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MinioModule } from './minio/minio.module';
import { BullModule } from '@nestjs/bullmq';
import { SelectionModule } from './modules/selection/selection.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Permission, User]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['src/.env.development'],
    }),
    ScheduleModule.forRoot(),
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
          entities: [
            User,
            Role,
            Permission,
            Product,
            ProductType,
            Order,
            Photo,
            OrderProduct,
            Link,
          ],
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
    LoggerModule,
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
    MinioInitService,
  ],
})
export class AppModule { }
