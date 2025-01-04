import { Injectable } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import basex from 'base-x';
import { Link, LinkStatus } from './entities/link.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { DatabaseException } from '../common/database-exception.filter';
import { generatePassword } from '../utils/generatePassword';
import { PaginationQuery } from '../common/custom.decorator';

const BASE60 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz_-';
const bs60 = basex(BASE60);

@Injectable()
export class LinkService {
  @InjectRepository(Link)
  private linkRepository: Repository<Link>;

  @InjectRepository(Order)
  private orderRepository: Repository<Order>;

  async create(createLinkDto: CreateLinkDto) {
    const { order_id, expires_at } = createLinkDto;
    const order = await this.orderRepository.findOne({
      where: { id: order_id },
    });

    if (!order) throw new DatabaseException('数据不存在');

    const { customer_phone } = order;
    const cur_time = new Date().getTime();
    const buffer = Buffer.from(
      `${order_id}_${customer_phone}_${cur_time}`,
      'utf-8',
    );
    const short_url = bs60.encode(buffer);

    const link = new Link();

    link.order = order;
    link.short_url = short_url;
    link.expires_at = new Date(expires_at);
    link.password = generatePassword(4);
    link.status = LinkStatus.ACTIVE;
    link.created_by = 1;

    return await this.linkRepository.save(link);
  }

  async findAll(pagination: PaginationQuery) {
    const { current, pageSize } = pagination;
    const [links, count] = await this.linkRepository.findAndCount({
      skip: (current - 1) * pageSize,
      take: pageSize,
    });
    return {
      list: links,
      total: count,
      current,
      pageSize,
    };
  }

  async remove(id: number) {
    const link = await this.linkRepository.findOneBy({ id });

    if (!link) throw new DatabaseException('数据不存在');
    await this.linkRepository.remove(link);

    return `This action removes a #${id} link`;
  }
}
