import { Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { MinioController } from './minio.controller';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Module({
  controllers: [MinioController],
  providers: [
    MinioService,
    {
      provide: 'MINIO_CLIENT',
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        console.log(process.env.NODE_ENV)
        console.log(configService.get('minio_endpoint'));
        return new Minio.Client({
          endPoint: configService.get('minio_endpoint'),
          port: configService.get('minio_port'),
          useSSL: false,
          accessKey: configService.get('minio_access_key'),
          secretKey: configService.get('minio_secret_key'),
        });
      },
    },
  ],
  exports: ['MINIO_CLIENT', MinioService],
})
export class MinioModule { }
