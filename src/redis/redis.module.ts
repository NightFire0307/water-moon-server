import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisController } from './redis.controller';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

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
        });
      },
    },
    {
      provide: 'SUBSCRIBER_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('redis_server_host'),
          port: configService.get<number>('redis_server_port'),
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule { }