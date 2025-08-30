import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { Subject } from "rxjs";
import { RedisService } from "@/redis/redis.service";

export interface SSEMessage {
  id?: string;                 // 可选，用于客户端断线重连
  type: ProcessingStatus // 事件类型
  orderNumber: string;
  filename: string;
  ossUrlMedium?: string;      // 可选中等图链接
  ossUrlThumbnail?: string;   // 可选缩略图链接
  message?: string;            // 可选描述或错误信息
  progress?: number;           // 可选进度，0~100
  retry?: number;              // 可选客户端重连时间（ms）
  data?: any;                  // 可选额外数据
}

export enum ProcessingStatus {
  UPLOADED = 'uploaded',
  COMPRESSED = 'compressed',
  DONE = 'done',
  ERROR = 'error',
}

@Injectable()
export class EventService {
  private subject = new Subject<SSEMessage>();

  constructor(private readonly redisService: RedisService) { }

  onModuleInit() {
    // 监听 Redis 消息并推送到 SSE
    this.redisService.onMessage((channel, message) => {
      if (channel === 'sse_event') {
        console.log('收到消息:', message);
        this.subject.next(JSON.parse(message));
      }
    });
  }

  getEventStream() {
    // 获取外部 SSE 事件流
    return this.subject.asObservable();
  }

  async pushMessage(data: SSEMessage) {
    // 推送消息到事件流
    await this.redisService.publish('sse_event', data);
  }
}