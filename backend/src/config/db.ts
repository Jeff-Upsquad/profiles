import pg from 'pg';
import { env } from './env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

function getConnectionConfig(): pg.ClientConfig {
  // Prefer DATABASE_URL if set (handles special chars in password)
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  if (!env.DB_HOST || !env.DB_PASSWORD) {
    throw new AppError(500, 'DATABASE_URL or DB_HOST+DB_PASSWORD environment variables are required');
  }

  return {
    host: env.DB_HOST,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  };
}

/**
 * Execute a direct PostgreSQL query, bypassing PostgREST schema cache.
 */
export async function queryPg<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const client = new pg.Client(getConnectionConfig());
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
