import { Injectable } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import basex from 'base-x';
import { Link, LinkStatus } from './entities/link.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { DatabaseException } from '../common/database-exception.filter';

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
    link.expires_at = new Date();
    link.password = '1234';
    link.status = LinkStatus.ACTIVE;
    link.created_by = 1;

    const newLink = await this.linkRepository.save(link);
    console.log(newLink);

    return 'This action adds a new link';
  }

  findAll() {
    return `This action returns all link`;
  }

  findOne(id: number) {
    return `This action returns a #${id} link`;
  }

  update(id: number, updateLinkDto: UpdateLinkDto) {
    return `This action updates a #${id} link`;
  }

  remove(id: number) {
    return `This action removes a #${id} link`;
  }
}
