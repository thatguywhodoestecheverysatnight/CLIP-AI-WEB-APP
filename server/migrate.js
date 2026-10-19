// Creates tables (and enables pgvector when possible) on the configured DATABASE_URL.
import { getDb, databaseUrl } from '../db/index.js';

if (!databaseUrl()) {
  console.error('Set DATABASE_URL (or POSTGRES_URL) first, e.g. DATABASE_URL=postgres://... npm run db:migrate');
  process.exit(1);
}
const db = await getDb();
console.log(`Schema ready on Postgres. Vector storage: ${db.vector ? 'pgvector' : 'REAL[] (pgvector not available)'}`);
process.exit(0);
