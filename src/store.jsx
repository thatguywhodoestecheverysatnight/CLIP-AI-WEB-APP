import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, auth, flushQueue, ApiError } from './api.js';
import { store, deviceId } from './storage.js';
import { track } from './telemetry.js';
import { modelledWeather, computeRisks } from '../../shared/risk.js';
import { computeIndex } from '../../shared/index-score.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const EMPTY_ME = {
  user: null, index: computeIndex({}), trend: [], activity: [], lessons: {}, checklist: {}, perceptions: {}, interpretations: {},
  reportsCount: 0, labSessions: 0, bookmarks: [], actions: [],
};

export function AppProvider({ children }) {
  const [token, setToken] = useState(auth.token);
  const [me, setMe] = useState(() => store.get('clip.me', EMPTY_ME));
  const [loc, setLoc] = useState(() => store.get('clip.loc'));
  const [weather, setWeather] = useState(null);
  const [booting, setBooting] = useState(Boolean(auth.token));
  const [toasts, setToasts] = useState([]);
  const [sheet, setSheet] = useState(null); // 'auth' | 'notifications' | 'location' | {type, ...}
  const [drawer, setDrawer] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const prevIndex = useRef(me.index?.overall ?? 0);

  const toast = useCallback((text, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const applyMe = useCallback((payload) => {
    if (!payload || !payload.user) return;
    setMe((prev) => {
      const next = { ...EMPTY_ME, ...prev, ...payload };
      store.set('clip.me', next);
      return next;
    });
    if (payload.index && payload.index.overall > prevIndex.current) {
      const gain = payload.index.overall - prevIndex.current;
      if (prevIndex.current > 0 || payload.index.overall >= 5) toast(`CLIP-AI Index +${gain}  (now ${payload.index.overall})`, 'ok');
      prevIndex.current = payload.index.overall;
    }
  }, [toast]);

  const setSession = useCallback((tok, payload) => {
    auth.token = tok;
    setToken(tok);
    prevIndex.current = payload?.index?.overall ?? 0;
    applyMe(payload);
    if (payload?.user?.district_id) {
      const l = { districtId: payload.user.district_id, district: payload.user.district, locality: payload.user.locality, lat: payload.user.lat, lon: payload.user.lon };
      if (l.lat != null) { setLoc(l); store.set('clip.loc', l); }
    }
  }, [applyMe]);

  // Boot: validate saved session, flush offline queue.
  useEffect(() => {
    if (!auth.token) { setBooting(false); return; }
    api('GET', '/me')
      .then((p) => { prevIndex.current = p.index.overall; applyMe(p); return flushQueue(); })
      .then((n) => { if (n) { toast(`${n} saved item${n > 1 ? 's' : ''} synced`, 'ok'); api('GET', '/me').then(applyMe).catch(() => {}); } })
      .catch((e) => { if (e.status === 401) { auth.token = null; setToken(null); setMe(EMPTY_ME); store.del('clip.me'); } })
      .finally(() => setBooting(false));
    const online = () => flushQueue().then((n) => n && toast(`${n} offline item${n > 1 ? 's' : ''} synced`, 'ok'));
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Weather follows the selected locality.
  useEffect(() => {
    if (!loc?.lat) return;
    let cancelled = false;
    setWeather((w) => (w && w.key === `${loc.lat},${loc.lon}` ? w : null));
    api('GET', `/weather?lat=${loc.lat}&lon=${loc.lon}&district=${loc.districtId}`, undefined, { timeout: 9000 })
      .then((w) => !cancelled && setWeather({ ...w, key: `${loc.lat},${loc.lon}` }))
      .catch(() => {
        if (cancelled) return;
        const w = modelledWeather(loc.lat, loc.lon);
        setWeather({ ...w, risks: computeRisks(w.today, loc.districtId), key: `${loc.lat},${loc.lon}`, note: 'Offline: showing modelled climatology.' });
      });
    return () => { cancelled = true; };
  }, [loc?.lat, loc?.lon, loc?.districtId]);

  const startGuest = useCallback(async (l) => {
    setLoc(l); store.set('clip.loc', l);
    const p = await api('POST', '/auth/guest', { deviceId: deviceId(), ...l });
    setSession(p.token, p);
    track('onboard_guest', { districtId: l.districtId, gps: Boolean(l.gps) }, 'welcome');
    return p;
  }, [setSession]);

  const register = useCallback(async (form) => {
    const p = await api('POST', '/auth/register', { ...form, ...(loc || {}) });
    setSession(p.token, p);
    track('auth_register', {}, 'auth');
    setConfetti((c) => c + 1);
    return p;
  }, [loc, setSession]);

  const login = useCallback(async (form) => {
    const p = await api('POST', '/auth/login', form);
    setSession(p.token, p);
    track('auth_login', {}, 'auth');
    return p;
  }, [setSession]);

  const logout = useCallback(() => {
    auth.token = null;
    setToken(null);
    setMe(EMPTY_ME);
    store.del('clip.me');
    track('auth_logout', {}, 'me');
  }, []);

  const changeLocation = useCallback(async (l) => {
    setLoc(l); store.set('clip.loc', l);
    track('location_change', { districtId: l.districtId }, 'location');
    if (auth.token) {
      try { applyMe(await api('PATCH', '/me', l)); } catch { /* non-blocking */ }
    }
  }, [applyMe]);

  /** Write helper: ensures a session exists, applies returned profile, handles errors. */
  const mutate = useCallback(async (method, path, body, opts = {}) => {
    if (!auth.token) {
      if (!loc) throw new ApiError(401, 'Choose your location first');
      await startGuest(loc);
    }
    try {
      const res = await api(method, path, body, opts);
      if (res?.queued) { toast('Saved offline. It will sync when you reconnect.', 'info'); return res; }
      if (res?.user) applyMe(res);
      return res;
    } catch (e) {
      if (e.status === 401 && loc) {
        auth.token = null;
        await startGuest(loc);
        const res = await api(method, path, body, opts);
        if (res?.user) applyMe(res);
        return res;
      }
      throw e;
    }
  }, [applyMe, loc, startGuest, toast]);

  const value = useMemo(() => ({
    token, me, loc, weather, booting, toasts, sheet, drawer, confetti,
    isGuest: !me.user || me.user.is_guest,
    toast, setSheet, setDrawer, startGuest, register, login, logout, changeLocation, mutate, applyMe,
    celebrate: () => setConfetti((c) => c + 1),
    refresh: () => api('GET', '/me').then(applyMe),
  }), [token, me, loc, weather, booting, toasts, sheet, drawer, confetti, toast, startGuest, register, login, logout, changeLocation, mutate, applyMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
