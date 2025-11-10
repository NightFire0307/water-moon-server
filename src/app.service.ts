import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import chalk from 'chalk';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly log: (...data: any[]) => void
  private readonly envs: Record<string, string> = {
    'DB_HOST': '数据库地址',
    'DB_PORT': '数据库端口',
    'DB_NAME': '数据库名称',
    'REDIS_HOST': 'Redis地址',
    'REDIS_PORT': 'Redis端口',
    'MINIO_HOST': 'Minio地址',
    'MINIO_PORT': 'Minio端口',
    'MINIO_BUCKET': 'Minio BucketName'
  }



  constructor(private readonly configService: ConfigService) {
    this.log = console.log
  }

  onApplicationBootstrap() {
    this.log(chalk.green("================== 环境变量 ================="))
    Object.keys(this.envs).forEach(key => {
      this.log(
        `${chalk.cyan(this.envs[key])}: ${chalk.yellow(this.configService.get<string>(key))}`
      )
    })
    this.log(chalk.green("============================================"))
  }
}
