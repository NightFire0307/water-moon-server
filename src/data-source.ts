import { DataSource } from 'typeorm';

export const appDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '123456',
  database: 'water_moon_select_photo_system',
  synchronize: false,
  logging: true,
  entities: ['./src/modules/**/*.entity.ts'],
  migrations: ['./src/migrations/*.ts'],
});