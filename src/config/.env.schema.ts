import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production')
    .default('development'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(3306),
  DB_NAME: Joi.string().required(),
  DB_USERNAME: Joi.string().default('root'),
  DB_PASSWORD: Joi.string().allow('').default(''),
  SYNC_DB: Joi.boolean().default(false),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  NEST_PORT: Joi.number().port().default(3000),
  HASH_SALT_ROUNDS: Joi.number().default(6),
  JWT_SECRET: Joi.string().required(),
  JWT_ACCESS_TOKEN_EXPIRES_TIME: Joi.string().default('1d'),
  JWT_REFRESH_TOKEN_EXPIRES_TIME: Joi.string().default('7d'),
  MINIO_BUCKET: Joi.string().default('water-moon'),
  MINIO_HOST: Joi.string().default('localhost'),
  MINIO_PORT: Joi.number().port().default(9090),
  MINIO_EXPIRE_TIME: Joi.number().default(7),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
}).unknown(true);
