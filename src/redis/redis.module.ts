import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisController } from './redis.controller';
import { Redis } from 'ioredis';

@Module({
  controllers: [RedisController],
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis(6379, 'localhost');
      },
    },
    {
      provide: 'SUBSCRIBER_CLIENT',
      useFactory: () => {
        return new Redis(6379, 'localhost');
      },
    },
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
