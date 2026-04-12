import pg from 'pg';
import { env } from './env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Execute a direct PostgreSQL query, bypassing PostgREST schema cache.
 * Use this for tables created after PostgREST was last reloaded.
 */
export async function queryPg<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!env.DB_HOST || !env.DB_PASSWORD) {
    throw new AppError(500, 'DB_HOST and DB_PASSWORD environment variables are required');
  }
  const client = new pg.Client({
    host: env.DB_HOST,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

/**
 * Execute a direct PostgreSQL query and return the first row or null.
 */
export async function queryPgOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryPg<T>(sql, params);
  return rows[0] ?? null;
}
