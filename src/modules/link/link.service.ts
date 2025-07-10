import { Inject, Injectable } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import basex from 'base-x';
import { Link, LinkStatus } from './entities/link.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { generatePassword } from '@/common/utils/generatePassword';
import { PaginationQuery } from '@/common/decorators/pagination.decorator';
import { RedisService } from '@/redis/redis.service';
import * as dayjs from 'dayjs';
import * as crypto from 'node:crypto';
import {
  CommonErrorCode,
  DatabaseException,
} from '@/common/exceptions/database.exception';

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
    const { password, expired_at, order_id, access_limit } = createLinkDto;
    const order = await this.orderRepository.findOneBy({ id: order_id });
    if (!order)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');

    if (expired_at) {
      const now = dayjs().unix();
      if (expired_at * 1000 < now) {
        throw new DatabaseException(
          CommonErrorCode.DATE_ERROR,
          '过期时间不能小于当前时间',
        );
      }
    }

    // 生成短链接
    const buffer = Buffer.from(
      `${order.id}_${order.order_number}_${crypto.randomBytes(6)}`,
      'utf-8',
    );
    const short_url = bs62.encode(buffer);

    const link = new Link();
    link.order = order;
    link.share_url = short_url;
    link.share_password = password ?? generatePassword(4);
    link.status = LinkStatus.ACTIVE;
    // 传递过来的时间戳是秒所以需要乘以1000
    link.expired_at = expired_at !== null ? new Date(expired_at * 1000) : null;
    link.created_by = 1;

    const result = await this.linkRepository.save(link);

    await this.redisService.addShareLink(
      order.order_number,
      link.share_url,
      link.share_password,
      access_limit ?? 0,
      expired_at,
    );

    return {
      data: result,
      msg: '创建成功',
    };
  }

  async getShareUrlByOrderId(orderId: number, pagination: PaginationQuery) {
    const { current, pageSize } = pagination;
    const order = await this.orderRepository.findOneBy({ id: orderId });
    if (!order)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '订单不存在');

    const [links, total] = await this.linkRepository.findAndCount({
      order: {
        created_at: 'DESC',
      },
      where: { order: { id: orderId } },
      take: pageSize,
      skip: (current - 1) * pageSize,
    });

    return {
      data: {
        list: links,
        total,
        current,
        pageSize,
      },
    };
  }

  async removeShareLinkByOrderId(id: number) {
    const link = await this.linkRepository.findOneBy({ id });

    if (!link)
      throw new DatabaseException(CommonErrorCode.NOT_FOUND, '链接不存在');
    await this.linkRepository.remove(link);

    return {
      data: id,
      msg: '删除成功',
    };
  }
}
