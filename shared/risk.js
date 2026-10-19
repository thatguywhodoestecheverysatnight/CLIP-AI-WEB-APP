// Local risk model. Combines today's weather with each district's baseline
// susceptibility. Thresholds follow IMD conventions where they exist:
//  - Rainfall (24h): light 2.5-15.5, moderate 15.6-64.4, heavy 64.5-115.5,
//    very heavy 115.6-204.4, extremely heavy >= 204.5 mm
//  - Wind: cyclonic storm 62-88 km/h, severe 89-117 km/h
//  - Heat: feels-like bands used for public guidance
import { getDistrict } from './locations.js';

export const HAZARDS = [
  { id: 'heat', label: 'Heat Risk', icon: '☀️', learn: 'heatwaves' },
  { id: 'rainfall', label: 'Rainfall', icon: '🌧️', learn: 'floods' },
  { id: 'flood', label: 'Flood Risk', icon: '🌊', learn: 'floods' },
  { id: 'cyclone', label: 'Cyclone Risk', icon: '🌀', learn: 'cyclones' },
  { id: 'salinity', label: 'Salinity Risk', icon: '🧂', learn: 'salinity' },
  { id: 'landslide', label: 'Landslide Risk', icon: '⛰️', learn: 'landslides' },
];

export const LEVELS = ['Low', 'Moderate', 'High', 'Severe'];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const level = (s) => (s >= 0.8 ? 'Severe' : s >= 0.55 ? 'High' : s >= 0.3 ? 'Moderate' : 'Low');

export function rainClass(mm) {
  if (mm >= 204.5) return 'Extremely heavy';
  if (mm >= 115.6) return 'Very heavy';
  if (mm >= 64.5) return 'Heavy';
  if (mm >= 15.6) return 'Moderate';
  if (mm >= 2.5) return 'Light';
  return 'Little or none';
}

// Maps 24h rainfall (mm) onto 0..1 so IMD class boundaries land on level cut-offs.
const RAIN_CURVE = [[0, 0], [2.5, 0.12], [15.6, 0.3], [64.5, 0.56], [115.6, 0.8], [204.5, 0.95], [400, 1]];
function piecewise(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x0, y0] = pts[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[pts.length - 1][1];
}

/**
 * @param {object} w  { tempMax, feelsMax, rainSum, rainProbMax, gustMax, humidity }
 * @param {string} districtId
 */
export function computeRisks(w, districtId) {
  const d = getDistrict(districtId) || { h: { heat: 0.5, flood: 0.5, cyclone: 0.3, salinity: 0.2, landslide: 0.1 } };
  const h = d.h;
  const feels = w.feelsMax ?? w.tempMax ?? 32;
  const rain = w.rainSum ?? 0;
  const gust = w.gustMax ?? 20;

  const heatS = clamp01((feels - 30) / 16) * 0.8 + h.heat * 0.2;
  const rainS = clamp01(piecewise(rain, RAIN_CURVE) * 0.92 + clamp01((w.rainProbMax ?? 0) / 100) * 0.08);
  const floodS = clamp01(h.flood * 0.45 + clamp01(rain / 115) * 0.55);
  const cycloneS = clamp01(h.cyclone * 0.35 + clamp01((gust - 30) / 70) * 0.65 * (0.4 + h.cyclone * 0.6));
  const salinityS = clamp01(h.salinity * 0.9 + (h.salinity > 0.4 ? clamp01((gust - 40) / 60) * 0.1 : 0));
  const landslideS = clamp01(h.landslide * 0.5 + h.landslide * clamp01(rain / 100) * 0.5);

  const risks = {
    heat: { score: heatS, value: `Feels like ${Math.round(feels)}°C` },
    rainfall: { score: rainS, value: rain < 1 ? 'Dry spell' : `${Math.max(0, Math.round(rain * 0.8))}-${Math.round(rain * 1.3 + 2)} mm` },
    flood: { score: floodS, value: floodS >= 0.55 ? 'Waterlogging likely' : floodS >= 0.3 ? 'Watch low-lying areas' : 'Rivers normal' },
    cyclone: { score: cycloneS, value: gust >= 62 ? `Gusts ${Math.round(gust)} km/h` : cycloneS >= 0.3 ? 'Coastal watch' : 'No alert' },
    salinity: { score: salinityS, value: h.salinity >= 0.4 ? 'Coastal areas' : h.salinity > 0.1 ? 'Tidal reaches' : 'Not exposed' },
    landslide: { score: landslideS, value: landslideS >= 0.55 ? 'Slopes unstable' : landslideS >= 0.3 ? 'Hill watch' : 'No alert' },
  };
  for (const k of Object.keys(risks)) risks[k].level = level(risks[k].score);
  return risks;
}

// Deterministic modelled weather used when the live feed is unavailable.
export function modelledWeather(lat, lon, date = new Date()) {
  const month = date.getMonth(); // 0..11
  // Seasonal climatology for the lower Gangetic plain, shifted for the hills.
  const hill = lat > 26.75 ? 1 : 0;
  const base = [25, 28, 33, 36, 36, 34, 32, 32, 32, 31, 29, 26][month] - hill * 11 - Math.max(0, lat - 24) * 0.6;
  const rainMonth = [5, 15, 25, 50, 120, 280, 330, 320, 260, 140, 25, 5][month];
  const seed = Math.sin(lat * 12.9898 + lon * 78.233 + date.getDate() * 3.1) * 43758.5453;
  const r = seed - Math.floor(seed);
  const hours = [6, 9, 12, 15, 18, 21];
  const shape = [-4, -1, 2, 3, 0, -2];
  const hourly = hours.map((hh, i) => ({ hour: hh, temp: Math.round(base + shape[i] + (r - 0.5) * 2) }));
  const humidity = Math.round(60 + (rainMonth / 330) * 30 - hill * 5);
  const tempMax = Math.max(...hourly.map((x) => x.temp));
  const feelsMax = tempMax + (humidity > 70 ? 3 : 1);
  const rainSum = Math.round((rainMonth / 30) * (0.3 + r * 1.4) * 10) / 10;
  return {
    source: 'modelled',
    current: { temp: hourly[2].temp, feels: hourly[2].temp + 2, humidity, wind: 10 + r * 8, code: rainSum > 10 ? 61 : 1 },
    hourly,
    today: { tempMax, feelsMax, rainSum, rainProbMax: Math.round(Math.min(95, rainMonth / 3.5)), gustMax: Math.round(20 + r * 20), humidity },
  };
}
