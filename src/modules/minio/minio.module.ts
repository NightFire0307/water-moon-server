import { Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Module({
  providers: [
    MinioService,
    {
      provide: 'MINIO_CLIENT',
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        return new Minio.Client({
          endPoint: configService.get('MINIO_HOST'),
          port: configService.get('MINIO_PORT'),
          useSSL: false,
          accessKey: configService.get('MINIO_ACCESS_KEY'),
          secretKey: configService.get('MINIO_SECRET_KEY'),
        });
      },
    },
  ],
  exports: ['MINIO_CLIENT', MinioService],
})
export class MinioModule { }
