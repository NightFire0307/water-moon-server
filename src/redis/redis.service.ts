import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  @Inject('SUBSCRIBER_CLIENT')
  private subscriber: Redis;

  async onModuleInit() {
    // 配置键空间通知（如果 Redis 已启用该设置）
    await this.subscriber.config('SET', 'notify-keyspace-events', 'Ex');

    // 订阅 key 过期事件
    await this.subscriber.psubscribe('__keyevent@0__:expired');

    // 监听过期事件
    this.subscriber.on('pmessage', (pattern, channel, message) => {
      console.log('key 过期了', message); // 输出过期的键名
    });

    console.log('Redis Listener Initialized');
  }

  async onModuleDestroy() {
    // 退出 Redis 客户端
    await this.subscriber.quit();
  }
}
