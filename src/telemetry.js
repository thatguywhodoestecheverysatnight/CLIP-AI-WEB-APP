// Batched interaction telemetry. Every screen view, dwell time and key tap is
// captured so the research dataset reflects how people actually use CLIP-AI.
import { auth } from './api.js';
import { sessionId } from './storage.js';

const BASE = import.meta.env.VITE_API_BASE || '/api';
let buffer = [];
let timer = null;
let currentScreen = 'boot';
let screenStart = Date.now();

function flush(useBeacon = false) {
  if (!buffer.length) return;
  const events = buffer.splice(0, 50);
  const payload = JSON.stringify({ events, token: auth.token });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(`${BASE}/events`, new Blob([payload], { type: 'application/json' }));
    return;
  }
  fetch(`${BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
    body: payload,
    keepalive: true,
  }).catch(() => { buffer = events.concat(buffer).slice(0, 200); });
}

export function track(type, payload = {}, screen = currentScreen) {
  buffer.push({ type, payload, screen, ts: new Date().toISOString(), sessionId: sessionId() });
  if (buffer.length >= 20) flush();
  if (!timer) timer = setInterval(() => flush(), 8000);
}

export function screenView(name, extra = {}) {
  const now = Date.now();
  if (currentScreen !== 'boot') track('screen_time', { seconds: Math.round((now - screenStart) / 1000) }, currentScreen);
  currentScreen = name;
  screenStart = now;
  track('screen_view', { ...extra, viewport: `${window.innerWidth}x${window.innerHeight}` }, name);
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      track('screen_time', { seconds: Math.round((Date.now() - screenStart) / 1000), hidden: true });
      screenStart = Date.now();
      flush(true);
    }
  });
  window.addEventListener('pagehide', () => flush(true));
}
