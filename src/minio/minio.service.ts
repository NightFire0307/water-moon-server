import { Inject, Injectable } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MinioService {
  @Inject('MINIO_CLIENT')
  private readonly minioClient: Minio.Client;

  @Inject(ConfigService)
  private readonly configService: ConfigService;

  /**
   * 生成MINIO上传策略
   * @param keyName 文件名
   * @param expires 上传策略过期时间（默认24小时）
   */
  async generatePostPolicy(keyName: string, expires?: Date) {
    const bucketName = this.configService.get('minio_bucket');
    const policy = this.minioClient.newPostPolicy();
    const expiresTime =
      expires || new Date(new Date().setSeconds(24 * 60 * 60));

    policy.setBucket(bucketName);
    policy.setKey(keyName);
    policy.setExpires(expiresTime);

    return await this.minioClient.presignedPostPolicy(policy);
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
}
