import { createPgAdapter } from './pg.js';
import { createMemoryAdapter } from './memory.js';

let adapter;

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.SUPABASE_DB_URL || '';
}

export async function getDb() {
  if (!adapter) {
    const url = databaseUrl();
    adapter = url ? createPgAdapter(url) : createMemoryAdapter();
    if (!url) console.warn('[db] DATABASE_URL not set: running in in-memory demo mode (data is not persisted).');
  }
  await adapter.init();
  return adapter;
}
