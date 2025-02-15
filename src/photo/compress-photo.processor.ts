import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'node:fs/promises';
import * as sharp from 'sharp';
import { MinioService } from '../minio/minio.service';
import { Subject } from 'rxjs';
import { Redis } from 'ioredis';

export interface CompressImageJobData {
  id: number;
  file_name: string;
  file_path: string;
  order_number: string;
  thumbnail_url?: string;
  original_url?: string;
  expires?: number;
}

@Processor('photo')
@Injectable()
export class CompressPhotoProcessor extends WorkerHost {
  @Inject(MinioService)
  private readonly minioService: MinioService;

  @Inject('REDIS_CLIENT')
  private readonly redisClient: Redis;

  private imageProcessedSubject = new Subject();

  async compressImage(imageBuffer: Buffer): Promise<Buffer> {
    return sharp(imageBuffer)
      .resize({ width: 800, fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  async process(job: Job<CompressImageJobData, any, string>): Promise<any> {
    console.log('BullMQ: ', job.data);
    const { file_name, file_path, order_number } = job.data;

    try {
      // 读取缓存图片
      const imageBuffer = await fs.readFile(file_path);
      // 压缩图片
      const compressImageBuffer = await this.compressImage(imageBuffer);
      // 设置图片过期时间
      const expires = 24 * 60 * 60 * 7;

      await Promise.all([
        this.minioService.uploadImage(
          compressImageBuffer,
          `${order_number}/thumbnail_${file_name}`,
        ),
        this.minioService.uploadImage(
          imageBuffer,
          `${order_number}/${file_name}`,
        ),
      ]);

      // 获取下载链接
      const thumbnail_url = await this.minioService.generateGetUrl(
        `${order_number}/thumbnail_${file_name}`,
        expires,
      );
      const original_url = await this.minioService.generateGetUrl(
        `${order_number}/${file_name}`,
        expires,
      );

      job.data.thumbnail_url = thumbnail_url;
      job.data.original_url = original_url;
      job.data.expires = Date.now() + expires * 1000;
    } catch (e) {
      console.log(e);
    }
  }

  @OnWorkerEvent('completed')
  async onActive(job: Job<CompressImageJobData, any, string>) {
    const {
      id,
      file_name,
      file_path,
      order_number,
      thumbnail_url,
      original_url,
      expires,
    } = job.data;

    // 图片临时链接存入 Redis
    await this.redisClient.hset(
      `photos_url:${order_number}`,
      id,
      JSON.stringify({ file_name, thumbnail_url, original_url, expires }),
    );

    // 移除缓存图片
    try {
      await fs.unlink(file_path);
    } catch (e) {
      console.log(e);
    }

    // 通知客户端图片处理完成
    this.imageProcessedSubject.next({
      order_number,
      thumbnail_url,
      original_url,
    });
  }

  // 服务端推送照片处理进度
  get imageProcessed$() {
    return this.imageProcessedSubject.asObservable();
  }
}
