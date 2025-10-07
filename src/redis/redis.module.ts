import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisController } from './redis.controller';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

const RETRY_CONNECT = 3;

@Module({
  controllers: [RedisController],
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('redis_server_host'),
          port: configService.get<number>('redis_server_port'),
          retryStrategy: (times) => {
            if (times >= RETRY_CONNECT) {
              console.error('Redis重试连接次数过多，停止重试');
              return null;
            }
            return 3000
          },
          maxRetriesPerRequest: 3
        })
      },
    },
    {
      provide: 'SUBSCRIBER_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('redis_server_host'),
          port: configService.get<number>('redis_server_port'),
          retryStrategy: (times) => {
            if (times >= RETRY_CONNECT) {
              console.error('Redis重试连接次数过多，停止重试');
              return null;
            }
            return 3000
          }
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT', 'SUBSCRIBER_CLIENT', RedisService],
})
export class RedisModule { }