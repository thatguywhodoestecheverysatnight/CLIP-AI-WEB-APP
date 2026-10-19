// PostgreSQL adapter (Neon, Supabase, Vercel Postgres, RDS, local).
// Uses pgvector when the extension can be enabled, otherwise REAL[].
import pg from 'pg';
import { TABLES, ddl, VECTOR_DIM } from './schema.js';

const { Pool } = pg;

function sslFor(url) {
  if (process.env.PGSSL === 'disable') return false;
  if (/localhost|127\.0\.0\.1|sslmode=disable/.test(url)) return false;
  return { rejectUnauthorized: false };
}

function ident(table, col) {
  if (!TABLES[table]) throw new Error(`Unknown table ${table}`);
  if (col !== undefined && col !== 'embedding' && !(col in TABLES[table].columns)) throw new Error(`Unknown column ${table}.${col}`);
  return col === undefined ? table : col;
}

function encode(table, col, val) {
  if (val === undefined) return undefined;
  if (TABLES[table].json.includes(col)) return JSON.stringify(val ?? null);
  return val;
}

function whereSql(table, where = {}, params = []) {
  const parts = [];
  for (const [col, cond] of Object.entries(where)) {
    ident(table, col);
    if (cond === null) parts.push(`${col} IS NULL`);
    else if (typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ('gte' in cond) { params.push(cond.gte); parts.push(`${col} >= $${params.length}`); }
      if ('lt' in cond) { params.push(cond.lt); parts.push(`${col} < $${params.length}`); }
      if ('in' in cond) { params.push(cond.in); parts.push(`${col} = ANY($${params.length})`); }
      if ('ne' in cond) { params.push(cond.ne); parts.push(`${col} <> $${params.length}`); }
    } else { params.push(cond); parts.push(`${col} = $${params.length}`); }
  }
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

export function createPgAdapter(url) {
  const g = globalThis;
  if (!g.__clipPgPool) {
    g.__clipPgPool = new Pool({
      connectionString: url,
      ssl: sslFor(url),
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    g.__clipPgPool.on('error', (e) => console.error('[pg] idle client error', e.message));
  }
  const pool = g.__clipPgPool;
  const q = (text, params) => pool.query(text, params);

  const adapter = {
    kind: 'postgres',
    vector: false,
    _ready: null,

    async init() {
      if (adapter._ready) return adapter._ready;
      adapter._ready = (async () => {
        try {
          await q('CREATE EXTENSION IF NOT EXISTS vector');
        } catch (e) {
          console.warn('[pg] pgvector unavailable, falling back to REAL[]:', e.message);
        }
        const ext = await q("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
        // If an embeddings table already exists, respect its column type.
        const col = await q("SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'embeddings' AND column_name = 'embedding'");
        adapter.vector = col.rows.length ? col.rows[0].udt_name === 'vector' : ext.rows.length > 0;
        for (const stmt of ddl(adapter.vector)) await q(stmt);
        if (adapter.vector) {
          try {
            await q('CREATE INDEX IF NOT EXISTS emb_hnsw_idx ON embeddings USING hnsw (embedding vector_cosine_ops)');
          } catch (e) {
            console.warn('[pg] HNSW index not created:', e.message);
          }
        }
        return true;
      })().catch((e) => { adapter._ready = null; throw e; });
      return adapter._ready;
    },

    async insert(table, row) {
      const cols = Object.keys(row).filter((c) => row[c] !== undefined);
      cols.forEach((c) => ident(table, c));
      const vals = cols.map((c) => encode(table, c, row[c]));
      const ph = cols.map((_, i) => `$${i + 1}`);
      const r = await q(`INSERT INTO ${ident(table)} (${cols.join(',')}) VALUES (${ph.join(',')}) RETURNING *`, vals);
      return r.rows[0];
    },

    async upsert(table, row) {
      const t = TABLES[table];
      const cols = Object.keys(row).filter((c) => row[c] !== undefined);
      cols.forEach((c) => ident(table, c));
      const vals = cols.map((c) => encode(table, c, row[c]));
      const ph = cols.map((_, i) => `$${i + 1}`);
      const updates = cols.filter((c) => !t.pk.includes(c)).map((c) => `${c} = EXCLUDED.${c}`);
      const r = await q(
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${ph.join(',')}) ON CONFLICT (${t.pk.join(',')}) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'} RETURNING *`,
        vals,
      );
      return r.rows[0];
    },

    async update(table, where, patch) {
      const params = [];
      const sets = Object.entries(patch).filter(([, x]) => x !== undefined).map(([c, x]) => {
        ident(table, c);
        params.push(encode(table, c, x));
        return `${c} = $${params.length}`;
      });
      if (!sets.length) return [];
      const w = whereSql(table, where, params);
      const r = await q(`UPDATE ${table} SET ${sets.join(', ')} ${w.sql} RETURNING *`, w.params);
      return r.rows;
    },

    async increment(table, where, col, by = 1) {
      ident(table, col);
      const params = [by];
      const w = whereSql(table, where, params);
      const r = await q(`UPDATE ${table} SET ${col} = ${col} + $1 ${w.sql} RETURNING *`, w.params);
      return r.rows[0];
    },

    async find(table, where = {}, opts = {}) {
      const w = whereSql(table, where, []);
      const order = opts.orderBy ? `ORDER BY ${ident(table, opts.orderBy)} ${opts.desc ? 'DESC' : 'ASC'}` : '';
      const lim = opts.limit ? `LIMIT ${Math.min(10000, Number(opts.limit) | 0)}` : '';
      const off = opts.offset ? `OFFSET ${Number(opts.offset) | 0}` : '';
      const cols = opts.columns ? opts.columns.map((c) => ident(table, c)).join(',') : '*';
      const r = await q(`SELECT ${cols} FROM ${table} ${w.sql} ${order} ${lim} ${off}`, w.params);
      return r.rows;
    },

    async findOne(table, where) {
      return (await adapter.find(table, where, { limit: 1 }))[0] || null;
    },

    async count(table, where = {}) {
      const w = whereSql(table, where, []);
      const r = await q(`SELECT COUNT(*)::int AS n FROM ${table} ${w.sql}`, w.params);
      return r.rows[0].n;
    },

    async remove(table, where) {
      const w = whereSql(table, where, []);
      if (!w.sql) throw new Error('Refusing to delete without a WHERE clause');
      const r = await q(`DELETE FROM ${table} ${w.sql}`, w.params);
      return r.rowCount;
    },

    async reassign(table, fromUser, toUser) {
      // Used to merge guest data into an existing account.
      ident(table, 'user_id');
      const pk = TABLES[table].pk;
      if (pk.includes('user_id')) {
        const other = pk.find((c) => c !== 'user_id');
        await q(`DELETE FROM ${table} a USING ${table} b WHERE a.user_id = $1 AND b.user_id = $2 AND a.${other} = b.${other}`, [fromUser, toUser]);
      }
      await q(`UPDATE ${table} SET user_id = $2 WHERE user_id = $1`, [fromUser, toUser]);
    },

    async upsertEmbedding(e) {
      const vec = adapter.vector ? `[${e.embedding.map((x) => Number(x).toFixed(6)).join(',')}]` : e.embedding;
      const r = await q(
        `INSERT INTO embeddings (id, entity_type, entity_id, user_id, dim, embedding, features, text)
         VALUES ($1,$2,$3,$4,$5,$6${adapter.vector ? '::vector' : ''},$7,$8)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET embedding = EXCLUDED.embedding, features = EXCLUDED.features, text = EXCLUDED.text, user_id = EXCLUDED.user_id, created_at = now()
         RETURNING id`,
        [e.id, e.entity_type, e.entity_id, e.user_id, VECTOR_DIM, vec, JSON.stringify(e.features || {}), e.text || null],
      );
      return r.rows[0];
    },

    async listEmbeddings({ entityType, limit = 2000, offset = 0 } = {}) {
      const params = [];
      let where = '';
      if (entityType) { params.push(entityType); where = 'WHERE entity_type = $1'; }
      const r = await q(
        `SELECT id, entity_type, entity_id, user_id, dim, embedding${adapter.vector ? '::text' : ''} AS embedding, features, text, created_at
         FROM embeddings ${where} ORDER BY created_at DESC LIMIT ${Math.min(20000, limit | 0)} OFFSET ${offset | 0}`,
        params,
      );
      return r.rows.map((row) => ({ ...row, embedding: typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding.map(Number) }));
    },

    async similar(vec, { entityType, limit = 10, excludeEntityId } = {}) {
      if (adapter.vector) {
        const params = [`[${vec.join(',')}]`];
        const conds = [];
        if (entityType) { params.push(entityType); conds.push(`entity_type = $${params.length}`); }
        if (excludeEntityId) { params.push(excludeEntityId); conds.push(`entity_id <> $${params.length}`); }
        const r = await q(
          `SELECT id, entity_type, entity_id, user_id, features, text, 1 - (embedding <=> $1::vector) AS score
           FROM embeddings ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
           ORDER BY embedding <=> $1::vector LIMIT ${Math.min(100, limit | 0)}`,
          params,
        );
        return r.rows.map((x) => ({ ...x, score: Number(x.score) }));
      }
      const all = await adapter.listEmbeddings({ entityType, limit: 5000 });
      return rankByCosine(vec, all.filter((x) => x.entity_id !== excludeEntityId), limit);
    },

    async stats() {
      const counts = {};
      for (const t of Object.keys(TABLES)) counts[t] = (await q(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n;
      const [byType, byDistrict, perc, events, daily, guests] = await Promise.all([
        q('SELECT issue_type AS key, COUNT(*)::int AS n FROM reports GROUP BY 1 ORDER BY 2 DESC'),
        q("SELECT COALESCE(district, 'Unknown') AS key, COUNT(*)::int AS n FROM users GROUP BY 1 ORDER BY 2 DESC LIMIT 25"),
        q('SELECT hazard AS key, COUNT(*)::int AS n, ROUND(AVG(severity)::numeric,2)::float AS severity, ROUND(AVG(vulnerability)::numeric,2)::float AS vulnerability, ROUND(AVG(trust)::numeric,2)::float AS trust, ROUND(AVG(urgency)::numeric,2)::float AS urgency FROM perceptions GROUP BY 1 ORDER BY 2 DESC'),
        q("SELECT type AS key, COUNT(*)::int AS n FROM events WHERE created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 30"),
        q("SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(DISTINCT user_id)::int AS users, COUNT(*)::int AS events FROM events WHERE created_at > now() - interval '14 days' GROUP BY 1 ORDER BY 1"),
        q('SELECT is_guest, COUNT(*)::int AS n FROM users GROUP BY 1'),
      ]);
      const idx = await q(`SELECT ROUND(AVG(overall))::int AS overall, ROUND(AVG(literacy))::int AS literacy, ROUND(AVG(interpretation))::int AS interpretation, ROUND(AVG(perception))::int AS perception, ROUND(AVG(adaptive))::int AS adaptive
        FROM (SELECT DISTINCT ON (user_id) * FROM index_snapshots ORDER BY user_id, created_at DESC) s`);
      return {
        counts,
        reportsByType: byType.rows,
        usersByDistrict: byDistrict.rows,
        perceptionByHazard: perc.rows,
        eventsByType: events.rows,
        dailyActivity: daily.rows,
        accounts: guests.rows.reduce((a, r) => ({ ...a, [r.is_guest ? 'guest' : 'registered']: r.n }), { guest: 0, registered: 0 }),
        averageIndex: idx.rows[0],
      };
    },

    async ping() {
      await q('SELECT 1');
      return true;
    },
  };
  return adapter;
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function rankByCosine(vec, rows, limit) {
  return rows
    .map(({ embedding, ...rest }) => ({ ...rest, score: cosine(vec, embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
