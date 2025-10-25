import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

@Injectable()
export class DatabaseService {
  constructor(
    private readonly dataSource: DataSource
  ) { }

  // 封装一个事务执行的方法
  async runInTransaction<T>(fn: (transactionalEntityManager: EntityManager) => Promise<T>): Promise<T> {
    return await this.dataSource.transaction(fn)
  }
}
