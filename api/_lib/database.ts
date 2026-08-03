import { Pool, type PoolConfig } from 'pg';

let pool: Pool | undefined;

export function postgresPoolConfig(databaseUrl = process.env.DATABASE_URL): PoolConfig {
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured.');
  return {
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 3,
    allowExitOnIdle: true,
  };
}

/**
 * Supabase transaction pooling does not support session-level named prepared
 * statements. Repository calls use Pool.query(text, values), so node-postgres
 * uses unnamed statements. Never pass a QueryConfig with a `name` property.
 */
export function researchPool(): Pool {
  pool ??= new Pool(postgresPoolConfig());
  return pool;
}
