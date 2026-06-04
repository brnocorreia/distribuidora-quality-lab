import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

export type TypeOrmConfigParams = {
  databaseUrl: string;
  nodeEnv?: string;
};

export function buildTypeOrmOptions(params: TypeOrmConfigParams): DataSourceOptions {
  const { databaseUrl, nodeEnv } = params;

  return {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    migrationsRun: true,
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    entities: [
      __dirname + '/../../**/*.aggregate{.ts,.js}',
      __dirname + '/../../**/*.entity{.ts,.js}',
    ],
    logging: nodeEnv === 'development' ? ['error', 'migration'] : ['error'],
  };
}

config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

export default new DataSource(
  buildTypeOrmOptions({
    databaseUrl,
    nodeEnv: process.env.NODE_ENV,
  }),
);
