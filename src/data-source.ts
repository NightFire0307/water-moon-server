import dotenv from 'dotenv'
import path from 'path'
import { DataSource } from 'typeorm';

dotenv.config({ path: path.join(__dirname, `.env.${process.env.NODE_ENV}`) });
export const appDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: true,
  entities: ['./dist/modules/**/*.entity.js'],
  migrations: ['./dist/migrations/*.js'],
});