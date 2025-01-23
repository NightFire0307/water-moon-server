import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as minio from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioInitService implements OnModuleInit {
  @Inject(ConfigService)
  private configService: ConfigService;

  @Inject('MINIO_CLIENT')
  private minioClient: minio.Client;

  async onModuleInit(): Promise<void> {
    const bucketName = this.configService.get('minio_bucket');
    const bucketExists = await this.minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      console.log('Bucket not exists, creating...');
      await this.minioClient.makeBucket(bucketName, 'cn-north-1');
    }
  }
}
