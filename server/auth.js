import crypto from 'node:crypto';
import { HttpError } from './http.js';
import { databaseUrl } from './db/index.js';

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  // Deterministic fallback so tokens survive cold starts; set AUTH_SECRET in production.
  return crypto.createHash('sha256').update(`clip-ai::${databaseUrl() || 'local-dev'}`).digest('hex');
}

export const authSecretConfigured = () => Boolean(process.env.AUTH_SECRET);

export function newId() {
  return crypto.randomUUID();
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

export function signToken(userId) {
  const body = Buffer.from(JSON.stringify({ sub: userId, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `v1.${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [ver, body, sig] = token.split('.');
  if (ver !== 'v1' || !body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.sub || Date.now() - payload.iat > TOKEN_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export async function requireUser(req, db) {
  const payload = verifyToken(bearer(req));
  if (!payload) throw new HttpError(401, 'Sign in or continue as guest first');
  const user = await db.findOne('users', { id: payload.sub });
  if (!user) throw new HttpError(401, 'Session expired, please start again');
  return user;
}

export function publicUser(u) {
  if (!u) return null;
  const { password_hash, device_id, ...rest } = u;
  return rest;
}

export function adminKey() {
  if (process.env.ADMIN_KEY) return process.env.ADMIN_KEY;
  return process.env.VERCEL ? null : 'dev-admin';
}

export function requireAdmin(req, url) {
  const key = adminKey();
  if (!key) throw new HttpError(503, 'Research console disabled: set the ADMIN_KEY environment variable');
  const given = req.headers['x-admin-key'] || url.searchParams.get('key');
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(key);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Invalid admin key');
}
