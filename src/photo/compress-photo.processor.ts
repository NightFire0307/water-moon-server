import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'node:fs/promises';
import * as sharp from 'sharp';
import { MinioService } from '../minio/minio.service';
import { Subject } from 'rxjs';

@Processor('photo')
@Injectable()
export class CompressPhotoProcessor extends WorkerHost {
  @Inject(MinioService)
  private readonly minioService: MinioService;

  private imageProcessedSubject = new Subject();

  async process(job: Job<any, any, string>): Promise<any> {
    console.log('BullMQ: ', job.data);
    const { fileName, filePath, orderNumber } = job.data;

    try {
      // 读取缓存图片
      const imageBuffer = await fs.readFile(filePath);
      // 压缩图片
      const compressImageBuffer = await sharp(imageBuffer)
        .resize({ width: 800, fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();

      await Promise.all([
        this.minioService.uploadImage(
          compressImageBuffer,
          `${orderNumber}/thumbnail_${fileName}`,
        ),
        this.minioService.uploadImage(
          imageBuffer,
          `${orderNumber}/${fileName}`,
        ),
      ]);

      // 获取下载链接
      const thumbnail_url = await this.minioService.generateGetUrl(
        `${orderNumber}/thumbnail_${fileName}`,
      );
      const original_url = await this.minioService.generateGetUrl(
        `${orderNumber}/${fileName}`,
      );

      // 移除缓存图片
      await fs.unlink(filePath);

      // 通知客户端图片处理完成
      this.imageProcessedSubject.next({
        orderNumber,
        thumbnail_url,
        original_url,
      });
    } catch (e) {
      console.log(e);
    }
  }

  // 服务端推送照片处理进度
  get imageProcessed$() {
    return this.imageProcessedSubject.asObservable();
  }
}
