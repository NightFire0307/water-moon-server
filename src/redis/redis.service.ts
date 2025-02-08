import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  RedisErrorType,
  RedisException,
} from '../common/redis-exception.filter';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  @Inject('REDIS_CLIENT')
  private redisClient: Redis;

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

  // 获取过期时间戳
  private getExpireTime(expired_at: number): number {
    const expired_in_sec = expired_at - Math.floor(new Date().getTime() / 1000);
    if (expired_in_sec < 0)
      throw new RedisException(
        RedisErrorType.EXPIRE_TIME_ERROR,
        '过期时间不能小于当前时间',
      );
    return expired_in_sec;
  }

  // 添加分享链接（带过期时间）
  async addShareLink(
    orderNumber: string,
    shareLink: string,
    password: string,
    ttl: number,
  ) {
    const hashKey = `share_link:${orderNumber}`;
    const zsetKey = `share_expires:${orderNumber}`;

    const expireAt = this.getExpireTime(ttl);
    const pipeline = this.redisClient.pipeline();
    pipeline.hset(hashKey, shareLink, password);
    pipeline.zadd(zsetKey, expireAt, shareLink);
    await pipeline.exec();
  }

  // 清理过期分享链接
  async cleanExpiredShareLinks(orderNumber: string) {
    const zsetKey = `share_expire:${orderNumber}`;
    const hashKey = `share_links:${orderNumber}`;
    const now = Math.floor(Date.now() / 1000);

    // 获取所有已过期的链接
    const expiredLinks = await this.redisClient.zrangebyscore(
      zsetKey,
      '-inf',
      now,
    );

    if (expiredLinks.length > 0) {
      // 事务删除已过期的链接
      const pipeline = this.redisClient.pipeline();
      pipeline.hdel(hashKey, ...expiredLinks);
      pipeline.zrem(zsetKey, ...expiredLinks);
      await pipeline.exec();
    }
  }

  // 定期清理过期分享链接
  @Cron('*/30 * * * *')
  async autoCleanShareLink() {
    const keys = await this.redisClient.keys('share_expires:*');
    for (const orderKey of keys) {
      const orderNumber = orderKey.split(':')[1];
      console.log('清理订单号为', orderNumber, '的过期链接');
      await this.cleanExpiredShareLinks(orderNumber);
    }
  }
}
