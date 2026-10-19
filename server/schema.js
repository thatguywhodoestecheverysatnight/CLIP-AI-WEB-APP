// Single source of truth for the CLIP-AI data model.
// Used by the Postgres adapter (DDL), the memory adapter (column whitelist)
// and the admin export endpoints.

export const VECTOR_DIM = 96;

export const TABLES = {
  users: {
    pk: ['id'],
    json: ['bookmarks', 'actions', 'meta'],
    columns: {
      id: 'TEXT PRIMARY KEY',
      created_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
      updated_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
      last_seen_at: 'TIMESTAMPTZ',
      is_guest: 'BOOLEAN NOT NULL DEFAULT TRUE',
      name: 'TEXT',
      email: 'TEXT UNIQUE',
      password_hash: 'TEXT',
      device_id: 'TEXT',
      state: "TEXT DEFAULT 'West Bengal'",
      district_id: 'TEXT',
      district: 'TEXT',
      locality: 'TEXT',
      lat: 'DOUBLE PRECISION',
      lon: 'DOUBLE PRECISION',
      consent_research: 'BOOLEAN NOT NULL DEFAULT TRUE',
      bookmarks: "JSONB NOT NULL DEFAULT '[]'",
      actions: "JSONB NOT NULL DEFAULT '[]'",
      meta: "JSONB NOT NULL DEFAULT '{}'",
    },
    indexes: ['CREATE INDEX IF NOT EXISTS users_district_idx ON users (district_id)', 'CREATE INDEX IF NOT EXISTS users_device_idx ON users (device_id)'],
    private: ['password_hash'],
  },
  events: {
    pk: ['id'],
    json: ['payload'],
    columns: {
      id: 'TEXT PRIMARY KEY',
      user_id: 'TEXT REFERENCES users(id) ON DELETE CASCADE',
      session_id: 'TEXT',
      type: 'TEXT NOT NULL',
      screen: 'TEXT',
      payload: "JSONB NOT NULL DEFAULT '{}'",
      client_ts: 'TIMESTAMPTZ',
      created_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
    indexes: ['CREATE INDEX IF NOT EXISTS events_user_idx ON events (user_id, created_at DESC)', 'CREATE INDEX IF NOT EXISTS events_type_idx ON events (type, created_at DESC)'],
  },
  lesson_progress: {
    pk: ['user_id', 'topic_id'],
    json: ['quiz_answers'],
    columns: {
      user_id: 'TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE',
      topic_id: 'TEXT NOT NULL',
      completed: 'BOOLEAN NOT NULL DEFAULT FALSE',
      quiz_score: 'INTEGER',
      quiz_answers: "JSONB NOT NULL DEFAULT '[]'",
      time_spent_s: 'INTEGER NOT NULL DEFAULT 0',
      opened_count: 'INTEGER NOT NULL DEFAULT 0',
      updated_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
    constraint: 'PRIMARY KEY (user_id, topic_id)',
  },
  interpretations: {
    pk: ['id'],
    json: ['answers'],
    columns: {
      id: 'TEXT PRIMARY KEY',
      user_id: 'TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE',
      warning_id: 'TEXT NOT NULL',
      answers: "JSONB NOT NULL DEFAULT '[]'",
      score: 'INTEGER NOT NULL',
      time_spent_s: 'INTEGER',
      created_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
    indexes: ['CREATE INDEX IF NOT EXISTS interp_user_idx ON interpretations (user_id)'],
  },
  perceptions: {
    pk: ['id'],
    json: ['context'],
    columns: {
      id: 'TEXT PRIMARY KEY',
      user_id: 'TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE',
      hazard: 'TEXT NOT NULL',
      severity: 'SMALLINT NOT NULL',
      vulnerability: 'SMALLINT',
      trust: 'SMALLINT',
      urgency: 'SMALLINT',
      comment: 'TEXT',
      district_id: 'TEXT',
      locality: 'TEXT',
      lat: 'DOUBLE PRECISION',
      lon: 'DOUBLE PRECISION',
      context: "JSONB NOT NULL DEFAULT '{}'",
      created_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
    indexes: ['CREATE INDEX IF NOT EXISTS perc_user_idx ON perceptions (user_id)', 'CREATE INDEX IF NOT EXISTS perc_district_idx ON perceptions (district_id, hazard)'],
  },
  reports: {
    pk: ['id'],
    json: ['tags', 'context'],
    columns: {
      id: 'TEXT PRIMARY KEY',
      user_id: 'TEXT REFERENCES users(id) ON DELETE CASCADE',
      description: 'TEXT NOT NULL',
      issue_type: 'TEXT NOT NULL',
      tags: "JSONB NOT NULL DEFAULT '[]'",
      photo: 'TEXT',
      has_photo: 'BOOLEAN NOT NULL DEFAULT FALSE',
      lat: 'DOUBLE PRECISION',
      lon: 'DOUBLE PRECISION',
      geotagged: 'BOOLEAN NOT NULL DEFAULT FALSE',
      district_id: 'TEXT',
      district: 'TEXT',
      locality: 'TEXT',
      upvotes: 'INTEGER NOT NULL DEFAULT 0',
      status: "TEXT NOT NULL DEFAULT 'open'",
      context: "JSONB NOT NULL DEFAULT '{}'",
      created_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
    indexes: ['CREATE INDEX IF NOT EXISTS reports_district_idx ON reports (district_id, created_at DESC)', 'CREATE INDEX IF NOT EXISTS reports_user_idx ON reports (user_id)'],
  },
  checklist: {
    pk: ['user_id', 'item_id'],
    json: [],
    columns: {
      user_id: 'TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE',
      item_id: 'TEXT NOT NULL',
      done: 'BOOLEAN NOT NULL DEFAULT FALSE',
      updated_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
    constraint: 'PRIMARY KEY (user_id, item_id)',
  },
  lab_sessions: {
    pk: ['id'],
    json: ['config', 'metrics'],
    columns: {
      id: 'TEXT PRIMARY KEY',
      user_id: 'TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE',
      config: "JSONB NOT NULL DEFAULT '{}'",
      metrics: "JSONB NOT NULL DEFAULT '{}'",
      created_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
  },
  index_snapshots: {
    pk: ['id'],
    json: [],
    columns: {
      id: 'TEXT PRIMARY KEY',
      user_id: 'TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE',
      literacy: 'SMALLINT NOT NULL',
      interpretation: 'SMALLINT NOT NULL',
      perception: 'SMALLINT NOT NULL',
      adaptive: 'SMALLINT NOT NULL',
      overall: 'SMALLINT NOT NULL',
      created_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
    indexes: ['CREATE INDEX IF NOT EXISTS snap_user_idx ON index_snapshots (user_id, created_at)'],
  },
  embeddings: {
    pk: ['id'],
    json: ['features'],
    columns: {
      id: 'TEXT PRIMARY KEY',
      entity_type: 'TEXT NOT NULL',
      entity_id: 'TEXT NOT NULL',
      user_id: 'TEXT REFERENCES users(id) ON DELETE CASCADE',
      dim: 'INTEGER NOT NULL',
      // embedding column is added by the adapter (vector or real[])
      features: "JSONB NOT NULL DEFAULT '{}'",
      text: 'TEXT',
      created_at: 'TIMESTAMPTZ NOT NULL DEFAULT now()',
    },
    constraint: 'UNIQUE (entity_type, entity_id)',
    indexes: ['CREATE INDEX IF NOT EXISTS emb_type_idx ON embeddings (entity_type)'],
  },
};

export const TABLE_ORDER = ['users', 'events', 'lesson_progress', 'interpretations', 'perceptions', 'reports', 'checklist', 'lab_sessions', 'index_snapshots', 'embeddings'];

export function ddl(vectorEnabled) {
  const out = [];
  for (const name of TABLE_ORDER) {
    const t = TABLES[name];
    const cols = Object.entries(t.columns).map(([c, type]) => `  ${c} ${type}`);
    if (name === 'embeddings') cols.splice(4, 0, `  embedding ${vectorEnabled ? `vector(${VECTOR_DIM})` : 'REAL[]'} NOT NULL`);
    if (t.constraint) cols.push(`  ${t.constraint}`);
    out.push(`CREATE TABLE IF NOT EXISTS ${name} (\n${cols.join(',\n')}\n)`);
    for (const ix of t.indexes || []) out.push(ix);
  }
  return out;
}
