import pg from 'pg';
import dns from 'dns';
import { env } from './env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// Force IPv4 DNS resolution to avoid ECONNREFUSED on IPv6
dns.setDefaultResultOrder('ipv4first');

function getProjectRef(): string {
  // Extract project ref from SUPABASE_URL (e.g. https://xxxxx.supabase.co → xxxxx)
  const match = env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? '';
}

function getConnectionConfig(): pg.ClientConfig {
  // Prefer DATABASE_URL if set
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  if (!env.DB_HOST || !env.DB_PASSWORD) {
    throw new AppError(500, 'DATABASE_URL or DB_HOST+DB_PASSWORD environment variables are required');
  }

  // Detect if using the Supabase pooler (pooler.supabase.com)
  const isPooler = env.DB_HOST.includes('pooler.supabase.com');
  const projectRef = getProjectRef();

  return {
    host: env.DB_HOST,
    port: isPooler ? 6543 : 5432,
    database: 'postgres',
    user: isPooler ? `postgres.${projectRef}` : 'postgres',
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
