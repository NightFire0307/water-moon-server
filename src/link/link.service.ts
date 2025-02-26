import { Inject, Injectable } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import basex from 'base-x';
import { Link, LinkStatus } from './entities/link.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import {
  DatabaseErrorType,
  DatabaseException,
} from '../common/database-exception.filter';
import { generatePassword } from '../utils/generatePassword';
import { PaginationQuery } from '../common/custom.decorator';
import { RedisService } from '../redis/redis.service';

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const bs62 = basex(BASE62);

@Injectable()
export class LinkService {
  @Inject(RedisService)
  private readonly redisService: RedisService;

  @InjectRepository(Link)
  private readonly linkRepository: Repository<Link>;

  @InjectRepository(Order)
  private readonly orderRepository: Repository<Order>;

  async generateShareUrl(createLinkDto: CreateLinkDto) {
    const { password, expired_at, order_id } = createLinkDto;
    const order = await this.orderRepository.findOneBy({ id: order_id });
    if (!order)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '订单不存在',
      );

    const cur_time = new Date().getTime();
    const buffer = Buffer.from(`${order.id}_${cur_time}`, 'utf-8');
    const short_url = bs62.encode(buffer);

    const link = new Link();
    link.order = order;
    link.share_url = short_url;
    link.share_password = password ?? generatePassword(4);
    link.status = LinkStatus.ACTIVE;
    // 传递过来的时间戳是秒所以需要乘以1000
    link.expired_at = expired_at !== 0 ? new Date(expired_at * 1000) : null;
    link.created_by = 1;

    const result = await this.linkRepository.save(link);

    delete result.order;

    await this.redisService.addShareLink(
      order.order_number,
      link.share_url,
      link.share_password,
      expired_at,
    );

    return {
      data: result,
    };
  }

  async findAll(pagination: PaginationQuery) {
    const { current, pageSize } = pagination;
    const [links, count] = await this.linkRepository.findAndCount({
      skip: (current - 1) * pageSize,
      take: pageSize,
    });
    return {
      data: {
        list: links,
        total: count,
        current,
        pageSize,
      },
    };
  }

  async remove(id: number) {
    const link = await this.linkRepository.findOneBy({ id });

    if (!link)
      throw new DatabaseException(
        DatabaseErrorType.DATA_NOT_FOUND,
        '数据不存在',
      );
    await this.linkRepository.remove(link);

    return `This action removes a #${id} link`;
  }
}
