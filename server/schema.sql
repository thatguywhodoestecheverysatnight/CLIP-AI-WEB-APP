-- CLIP-AI schema (PostgreSQL 14+). Optional: the app creates these automatically on first request.

CREATE EXTENSION IF NOT EXISTS vector;



CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  is_guest BOOLEAN NOT NULL DEFAULT TRUE,
  name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  device_id TEXT,
  state TEXT DEFAULT 'West Bengal',
  district_id TEXT,
  district TEXT,
  locality TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  consent_research BOOLEAN NOT NULL DEFAULT TRUE,
  bookmarks JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  meta JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS users_district_idx ON users (district_id);

CREATE INDEX IF NOT EXISTS users_device_idx ON users (device_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  type TEXT NOT NULL,
  screen TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  client_ts TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_user_idx ON events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS events_type_idx ON events (type, created_at DESC);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  quiz_score INTEGER,
  quiz_answers JSONB NOT NULL DEFAULT '[]',
  time_spent_s INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS interpretations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warning_id TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  score INTEGER NOT NULL,
  time_spent_s INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interp_user_idx ON interpretations (user_id);

CREATE TABLE IF NOT EXISTS perceptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hazard TEXT NOT NULL,
  severity SMALLINT NOT NULL,
  vulnerability SMALLINT,
  trust SMALLINT,
  urgency SMALLINT,
  comment TEXT,
  district_id TEXT,
  locality TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS perc_user_idx ON perceptions (user_id);

CREATE INDEX IF NOT EXISTS perc_district_idx ON perceptions (district_id, hazard);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  photo TEXT,
  has_photo BOOLEAN NOT NULL DEFAULT FALSE,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  geotagged BOOLEAN NOT NULL DEFAULT FALSE,
  district_id TEXT,
  district TEXT,
  locality TEXT,
  upvotes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_district_idx ON reports (district_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_user_idx ON reports (user_id);

CREATE TABLE IF NOT EXISTS checklist (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS lab_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS index_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  literacy SMALLINT NOT NULL,
  interpretation SMALLINT NOT NULL,
  perception SMALLINT NOT NULL,
  adaptive SMALLINT NOT NULL,
  overall SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS snap_user_idx ON index_snapshots (user_id, created_at);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  embedding vector(96) NOT NULL,
  dim INTEGER NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS emb_type_idx ON embeddings (entity_type);

CREATE INDEX IF NOT EXISTS emb_hnsw_idx ON embeddings USING hnsw (embedding vector_cosine_ops);

