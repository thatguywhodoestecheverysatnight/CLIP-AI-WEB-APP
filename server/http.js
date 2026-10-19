// Minimal, framework-agnostic HTTP helpers. Works with Vercel Node functions,
// the Vite dev middleware and the standalone Node server.

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const MAX_BODY = 4 * 1024 * 1024; // Vercel hard limit is 4.5 MB

export async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return {};
  // Vercel pre-parses JSON into req.body lazily.
  try {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
      if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
      if (typeof req.body === 'object') return req.body;
    }
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Payload too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export function send(res, status, data, headers = {}) {
  const isText = typeof data === 'string';
  res.statusCode = status;
  res.setHeader('Content-Type', headers['Content-Type'] || (isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8'));
  res.setHeader('Cache-Control', headers['Cache-Control'] || 'no-store');
  for (const [k, v] of Object.entries(headers)) if (k !== 'Content-Type' && k !== 'Cache-Control') res.setHeader(k, v);
  res.end(isText ? data : JSON.stringify(data));
}

export function cors(req, res) {
  const origin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (Array.isArray(xf) ? xf[0] : xf || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// Best-effort per-instance rate limiter (serverless instances are short-lived).
const buckets = new Map();
export function rateLimit(key, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, t: now };
  if (now - b.t > windowMs) { b.n = 0; b.t = now; }
  b.n += 1;
  buckets.set(key, b);
  if (buckets.size > 5000) buckets.clear();
  if (b.n > limit) throw new HttpError(429, 'Too many requests, slow down');
}

// ---- validation helpers ----
export const v = {
  str(x, { max = 500, min = 0, field = 'value', optional = false } = {}) {
    if (x === undefined || x === null || x === '') {
      if (optional) return null;
      if (min > 0) throw new HttpError(400, `${field} is required`);
      return '';
    }
    const s = String(x).trim();
    if (s.length < min) throw new HttpError(400, `${field} is too short`);
    if (s.length > max) throw new HttpError(400, `${field} is too long (max ${max})`);
    return s;
  },
  int(x, { min = -Infinity, max = Infinity, field = 'value', optional = false } = {}) {
    if (x === undefined || x === null || x === '') {
      if (optional) return null;
      throw new HttpError(400, `${field} is required`);
    }
    const n = Math.round(Number(x));
    if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} must be between ${min} and ${max}`);
    return n;
  },
  num(x, { min = -Infinity, max = Infinity, field = 'value', optional = true } = {}) {
    if (x === undefined || x === null || x === '') {
      if (optional) return null;
      throw new HttpError(400, `${field} is required`);
    }
    const n = Number(x);
    if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} is out of range`);
    return n;
  },
  oneOf(x, list, field = 'value') {
    if (!list.includes(x)) throw new HttpError(400, `${field} must be one of: ${list.join(', ')}`);
    return x;
  },
  email(x) {
    const s = v.str(x, { max: 200, min: 3, field: 'email' }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new HttpError(400, 'Enter a valid email address');
    return s;
  },
  obj(x, maxBytes = 20000) {
    if (x === undefined || x === null) return {};
    if (typeof x !== 'object') throw new HttpError(400, 'Expected an object');
    if (JSON.stringify(x).length > maxBytes) throw new HttpError(413, 'Object too large');
    return x;
  },
};
