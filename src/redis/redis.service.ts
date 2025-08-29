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
  private readonly publisher: Redis;

  @Inject('SUBSCRIBER_CLIENT')
  private readonly subscriber: Redis;

  async onModuleInit() {
    // 订阅 SSE 渠道
    await this.subscriber.subscribe('sse_event');
  }

  async onModuleDestroy() {
    // 退出 Redis 客户端
    await this.subscriber.quit();
  }

  async publish(channel: string, message: any) {
    return this.publisher.publish(channel, JSON.stringify(message));
  }

  onMessage(callback: (channel: string, message: string) => void) {
    this.subscriber.on('message', callback);
  }

  // 获取过期时间戳
  // private getExpireTime(expired_at: number): number {
  //   const expired_in_sec = expired_at - Math.floor(new Date().getTime() / 1000);
  //   if (expired_in_sec < 0)
  //     throw new RedisException(
  //       RedisErrorType.EXPIRE_TIME_ERROR,
  //       '过期时间不能小于当前时间',
  //     );
  //   return expired_in_sec;
  // }

  // 添加分享链接（带过期时间）
  async addShareLink(
    orderNumber: string,
    shareLink: string,
    password: string,
    access_limit: number,
    ttl: number | null,
  ) {
    // const hashKey = `share_link:${orderNumber}`;
    // const zsetKey = `share_expires:${orderNumber}`;

    // const pipeline = this.redisClient.pipeline();
    // if (ttl !== 0) {
    //   const expireAt = this.getExpireTime(ttl);
    //   pipeline.zadd(zsetKey, expireAt, shareLink);
    // }
    // pipeline.hset(
    //   hashKey,
    //   shareLink,
    //   JSON.stringify({ password, access_limit }),
    // );
    // await pipeline.exec();
  }

  // // 清理过期分享链接
  // async cleanExpiredShareLinks(orderNumber: string) {
  //   const zsetKey = `share_expire:${orderNumber}`;
  //   const hashKey = `share_links:${orderNumber}`;
  //   const now = Math.floor(Date.now() / 1000);

  //   // 获取所有已过期的链接
  //   const expiredLinks = await this.redisClient.zrangebyscore(
  //     zsetKey,
  //     '-inf',
  //     now,
  //   );

  //   if (expiredLinks.length > 0) {
  //     // 事务删除已过期的链接
  //     const pipeline = this.redisClient.pipeline();
  //     pipeline.hdel(hashKey, ...expiredLinks);
  //     pipeline.zrem(zsetKey, ...expiredLinks);
  //     await pipeline.exec();
  //   }
  // }

  // // 定期清理过期分享链接
  // @Cron('*/30 * * * *')
  // async autoCleanShareLink() {
  //   const keys = await this.redisClient.keys('share_expires:*');
  //   console.log('清理过期链接');
  //   for (const orderKey of keys) {
  //     const orderNumber = orderKey.split(':')[1];
  //     await this.cleanExpiredShareLinks(orderNumber);
  //   }
  // }
}
