import { DataSource } from 'typeorm';
import { Permission } from './modules/auth/entities/permissions.entity';
import { User } from './modules/auth/entities/user.entity';
import { Link } from './modules/link/entities/link.entity';
import { Order } from './modules/order/entities/order.entity';
import { OrderProduct } from './modules/order/entities/orderProduct.entity';
import { Photo } from './modules/photo/entities/photo.entity';
import { Product } from './modules/product/entities/product.entity';
import { ProductType } from './modules/product/entities/productType.entity';
import { Role } from './modules/role/entities/role.entity';
import { config } from 'dotenv';
import * as path from 'path'

console.log(path.resolve(__dirname, 'config/.env.migration'));

config({
  path: path.resolve(__dirname, 'config/.env.migration'),
})

function toBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: toBoolean(process.env.mysql_server_synchronize),
  logging: toBoolean(process.env.DB_LOGGING),
  entities: [
    User,
    Role,
    Permission,
    Product,
    ProductType,
    Order,
    Photo,
    OrderProduct,
    Link,
  ],
  migrations: ['src/migrations/*.ts'],
  poolSize: 10,
  connectorPackage: 'mysql2',
});