// Live weather from Open-Meteo (free, no API key) with an in-process cache and
// a deterministic modelled fallback so the app never shows a blank snapshot.
import { modelledWeather, computeRisks } from '../shared/risk.js';
import { nearestLocality } from '../shared/locations.js';

const cache = new Map();
const TTL = 15 * 60 * 1000;
const HOURS = [6, 9, 12, 15, 18, 21];

async function fetchOpenMeteo(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_gusts_10m',
    daily: 'temperature_2m_max,apparent_temperature_max,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max',
    timezone: 'Asia/Kolkata',
    forecast_days: '2',
  }).toString();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4500);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'CLIP-AI/1.0' } });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const j = await res.json();
    const day = j.daily.time[0];
    const idx = (hh) => j.hourly.time.indexOf(`${day}T${String(hh).padStart(2, '0')}:00`);
    const hourly = HOURS.map((hh) => {
      const i = idx(hh);
      return { hour: hh, temp: Math.round(j.hourly.temperature_2m[i]), feels: Math.round(j.hourly.apparent_temperature[i]), rainProb: j.hourly.precipitation_probability?.[i] ?? null };
    });
    return {
      source: 'open-meteo',
      current: {
        temp: Math.round(j.current.temperature_2m),
        feels: Math.round(j.current.apparent_temperature),
        humidity: j.current.relative_humidity_2m,
        wind: j.current.wind_speed_10m,
        code: j.current.weather_code,
        precipitation: j.current.precipitation,
      },
      hourly,
      today: {
        tempMax: j.daily.temperature_2m_max[0],
        feelsMax: j.daily.apparent_temperature_max[0],
        rainSum: j.daily.precipitation_sum[0],
        rainProbMax: j.daily.precipitation_probability_max?.[0] ?? null,
        gustMax: j.daily.wind_gusts_10m_max[0],
        humidity: j.current.relative_humidity_2m,
      },
      tomorrow: {
        tempMax: j.daily.temperature_2m_max[1],
        feelsMax: j.daily.apparent_temperature_max[1],
        rainSum: j.daily.precipitation_sum[1],
        gustMax: j.daily.wind_gusts_10m_max[1],
      },
    };
  } finally {
    clearTimeout(t);
  }
}

export async function getWeather(lat, lon, districtId) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  let w;
  if (hit && Date.now() - hit.t < TTL) w = hit.w;
  else {
    try {
      if (process.env.WEATHER_PROVIDER === 'off') throw new Error('disabled');
      w = await fetchOpenMeteo(lat, lon);
    } catch (e) {
      w = { ...modelledWeather(lat, lon), note: `Live feed unavailable (${e.message}), showing modelled climatology.` };
    }
    w.fetchedAt = new Date().toISOString();
    cache.set(key, { t: Date.now(), w });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
  }
  const district = districtId || nearestLocality(lat, lon)?.districtId;
  return { ...w, districtId: district, risks: computeRisks(w.today, district) };
}
