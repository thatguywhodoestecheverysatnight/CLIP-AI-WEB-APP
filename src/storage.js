// Safe localStorage wrapper (private mode / blocked storage must not crash the app).
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function deviceId() {
  let id = store.get('clip.device');
  if (!id) { id = uuid(); store.set('clip.device', id); }
  return id;
}

let sid;
export function sessionId() {
  if (sid) return sid;
  try {
    sid = sessionStorage.getItem('clip.session');
    if (!sid) { sid = uuid(); sessionStorage.setItem('clip.session', sid); }
  } catch { sid = uuid(); }
  return sid;
}
