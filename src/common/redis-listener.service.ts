import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisListenerService implements OnModuleInit, OnModuleDestroy {
  @Inject('REDIS_LISTENER')
  private redisClient: RedisClientType;

  async onModuleInit() {
    // 监听所有 key 过期事件
    await this.redisClient.configSet('notify-keyspace-events', 'Ex');

    // 订阅 key 过期事件
    await this.redisClient.subscribe('__keyevent@0__:expired', (message) => {
      console.log('key 过期了', message);
    });

    console.log('Redis Listener Initialized');
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}
