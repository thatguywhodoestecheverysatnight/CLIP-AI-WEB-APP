// API client with auth, timeouts and an offline write queue so field reports
// are never lost on a patchy mobile connection.
import { store } from './storage.js';

const BASE = import.meta.env.VITE_API_BASE || '/api';
const QUEUE_KEY = 'clip.queue';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const auth = {
  get token() { return store.get('clip.token'); },
  set token(t) { if (t) store.set('clip.token', t); else store.del('clip.token'); },
};

export async function api(method, path, body, { timeout = 15000, queueable = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (queueable) {
      const q = store.get(QUEUE_KEY, []);
      q.push({ method, path, body, at: Date.now() });
      store.set(QUEUE_KEY, q.slice(-50));
      return { queued: true };
    }
    throw new ApiError(0, navigator.onLine === false ? 'You are offline. Check your connection.' : 'Could not reach the server. Try again.');
  } finally {
    clearTimeout(timer);
  }
}

export function queuedCount() {
  return store.get(QUEUE_KEY, []).length;
}

export async function flushQueue() {
  const q = store.get(QUEUE_KEY, []);
  if (!q.length || !auth.token) return 0;
  const remaining = [];
  let sent = 0;
  for (const item of q) {
    try {
      await api(item.method, item.path, item.body);
      sent += 1;
    } catch (e) {
      if (e.status === 0) remaining.push(item); // still offline, keep it
    }
  }
  store.set(QUEUE_KEY, remaining);
  return sent;
}
