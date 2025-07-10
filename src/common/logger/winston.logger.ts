import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import 'winston-daily-rotate-file'

const logDir = 'logs'; // 日志文件目录

// 定义 Winston 配置选项
export const winstonLoggerOptions: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        nestWinstonModuleUtilities.format.nestLike('water-moon-server', {
          prettyPrint: true
        }),
      )
    }),
    // 记录 error 级别的日志到文件
    new winston.transports.DailyRotateFile({
      // 日志文件格式
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      level: 'error',
      dirname: `${logDir}/error`,
      filename: '%DATE%-error.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxFiles: '30d',
    }),

    // 记录 info 级别的日志到文件
    new winston.transports.DailyRotateFile({
      // 日志文件格式
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      level: 'info',
      filename: 'logs/%DATE%-info.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    })
  ]
}