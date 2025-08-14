import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as dayjs from 'dayjs';

@Injectable()
export class MinioService implements OnModuleInit {
  @Inject('MINIO_CLIENT')
  private readonly minioClient: Minio.Client;

  @Inject(ConfigService)
  private readonly configService: ConfigService;

  async onModuleInit(): Promise<void> {
    const bucketName = this.configService.get('minio_bucket');
    const bucketExists = await this.minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      console.log('Bucket not exists, creating...');
      await this.minioClient.makeBucket(bucketName, 'cn-north-1');
    }
  }

  /**
   * 生成MINIO上传策略
   * @param keyName 文件名
   * @param expires 上传策略过期时间（默认24小时）
   */
  async generatePostPolicy(keyName: string, expires?: Date) {
    const bucketName = this.configService.get('minio_bucket');
    const policy = this.minioClient.newPostPolicy();
    const expiresTime = expires || dayjs().add(24, 'hour').toDate();

    policy.setBucket(bucketName);
    policy.setKey(keyName);
    policy.setExpires(expiresTime);

    return await this.minioClient.presignedPostPolicy(policy);
  }

  /**
   * 生成MINIO下载链接
   * @param keyName 文件名
   * @param expires 下载链接过期时间（默认 7 天，以秒为单位）
   */
  async generateGetUrl(keyName: string, expires?: number) {
    const bucketName: string = this.configService.get('minio_bucket');

    return await this.minioClient.presignedGetObject(
      bucketName,
      keyName,
      expires,
    );
  }

  /**
   * 上传图片到MINIO
   * @param imageBuffer 图片Buffer
   * @param keyName 图片名称
   */
  async uploadImage(imageBuffer: Buffer, keyName: string) {
    const bucketName = this.configService.get('minio_bucket');
    const url = await this.minioClient.presignedPutObject(bucketName, keyName);

    await axios.put(url, imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
      },
    });
  }

  async downloadImage(keyName: string) {
    const bucketName = this.configService.get('minio_bucket');
    return await this.minioClient.getObject(bucketName, keyName);
  }
}
