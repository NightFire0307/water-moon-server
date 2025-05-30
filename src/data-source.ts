import { DataSource } from 'typeorm';
import { config } from 'dotenv';
config({ path: process.env.NODE_ENV === 'production' ? './src/.env.production' : './src/.env' });

import { Permission } from './modules/auth/entities/permissions.entity';
import { User } from './modules/auth/entities/user.entity';
import { Link } from './modules/link/entities/link.entity';
import { Order } from './modules/order/entities/order.entity';
import { OrderProduct } from './modules/order/entities/orderProduct.entity';
import { Photo } from './modules/photo/entities/photo.entity';
import { Product } from './modules/product/entities/product.entity';
import { ProductType } from './modules/product/entities/productType.entity';
import { Role } from './modules/role/entities/role.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.mysql_server_host,
  port: Number(process.env.mysql_server_port),
  username: process.env.mysql_server_login_username,
  password: process.env.mysql_server_login_password,
  database: process.env.mysql_server_database,
  synchronize: false,
  logging: true,
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
  extra: {
    authPlugin: 'sha256_password',
  }
});