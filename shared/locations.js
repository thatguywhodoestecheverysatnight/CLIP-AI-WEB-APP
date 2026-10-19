// West Bengal districts, localities and baseline hazard susceptibility.
// Hazard baselines are 0..1 relative indices used by the risk model. They are
// planning-grade approximations drawn from the general geography of each
// district (coastal exposure, river systems, hill terrain, aridity) and should
// be replaced by official vulnerability atlas values when available.

export const STATE = 'West Bengal';

// h = { heat, flood, cyclone, salinity, landslide }, coastal = distance class
export const DISTRICTS = [
  { id: 'kolkata', name: 'Kolkata', lat: 22.5726, lon: 88.3639, h: { heat: 0.72, flood: 0.55, cyclone: 0.55, salinity: 0.3, landslide: 0.02 },
    localities: [['Esplanade', 22.5646, 88.3519], ['Park Street', 22.553, 88.352], ['Ballygunge', 22.5276, 88.364], ['Behala', 22.4986, 88.31], ['Garia', 22.4637, 88.388], ['Tollygunge', 22.499, 88.346], ['Shyambazar', 22.6, 88.373], ['Jadavpur', 22.499, 88.371], ['Kasba', 22.515, 88.387], ['Gariahat', 22.518, 88.367]] },
  { id: 'north-24-parganas', name: 'North 24 Parganas', lat: 22.72, lon: 88.55, h: { heat: 0.65, flood: 0.6, cyclone: 0.6, salinity: 0.5, landslide: 0.02 },
    localities: [['Salt Lake', 22.5867, 88.4171], ['New Town', 22.592, 88.4847], ['Barasat', 22.723, 88.48], ['Dum Dum', 22.622, 88.42], ['Barrackpore', 22.764, 88.377], ['Basirhat', 22.657, 88.867], ['Bongaon', 23.045, 88.82], ['Hasnabad', 22.573, 88.92], ['Sandeshkhali', 22.37, 88.88]] },
  { id: 'south-24-parganas', name: 'South 24 Parganas', lat: 22.16, lon: 88.43, h: { heat: 0.55, flood: 0.8, cyclone: 0.92, salinity: 0.92, landslide: 0.01 },
    localities: [['Sonarpur', 22.443, 88.432], ['Baruipur', 22.357, 88.432], ['Diamond Harbour', 22.191, 88.19], ['Kakdwip', 21.877, 88.184], ['Sagar Island', 21.65, 88.08], ['Canning', 22.315, 88.665], ['Gosaba', 22.165, 88.807], ['Namkhana', 21.77, 88.231], ['Budge Budge', 22.472, 88.178]] },
  { id: 'howrah', name: 'Howrah', lat: 22.5958, lon: 88.2636, h: { heat: 0.7, flood: 0.62, cyclone: 0.5, salinity: 0.25, landslide: 0.01 },
    localities: [['Howrah', 22.5958, 88.2636], ['Bally', 22.65, 88.34], ['Shibpur', 22.57, 88.31], ['Uluberia', 22.47, 88.1], ['Domjur', 22.63, 88.22], ['Amta', 22.58, 88.01]] },
  { id: 'hooghly', name: 'Hooghly', lat: 22.9, lon: 88.2, h: { heat: 0.7, flood: 0.6, cyclone: 0.4, salinity: 0.12, landslide: 0.01 },
    localities: [['Chandannagar', 22.8671, 88.3674], ['Chinsurah', 22.9, 88.39], ['Serampore', 22.7505, 88.3406], ['Singur', 22.81, 88.23], ['Bandel', 22.92, 88.38], ['Uttarpara', 22.67, 88.35], ['Arambagh', 22.88, 87.78], ['Tarakeswar', 22.89, 88.02]] },
  { id: 'nadia', name: 'Nadia', lat: 23.4, lon: 88.5, h: { heat: 0.72, flood: 0.62, cyclone: 0.3, salinity: 0.05, landslide: 0.01 },
    localities: [['Krishnanagar', 23.4058, 88.49], ['Kalyani', 22.975, 88.4344], ['Ranaghat', 23.18, 88.57], ['Nabadwip', 23.4, 88.37], ['Shantipur', 23.25, 88.43]] },
  { id: 'murshidabad', name: 'Murshidabad', lat: 24.18, lon: 88.27, h: { heat: 0.78, flood: 0.72, cyclone: 0.15, salinity: 0.02, landslide: 0.02 },
    localities: [['Berhampore', 24.1, 88.25], ['Murshidabad', 24.18, 88.27], ['Jangipur', 24.47, 88.07], ['Kandi', 23.95, 88.03], ['Domkal', 24.12, 88.54]] },
  { id: 'malda', name: 'Malda', lat: 25.0, lon: 88.14, h: { heat: 0.75, flood: 0.78, cyclone: 0.1, salinity: 0.01, landslide: 0.03 },
    localities: [['English Bazar', 25.0, 88.14], ['Old Malda', 25.03, 88.15], ['Gazole', 25.22, 88.18], ['Chanchal', 25.39, 88.01]] },
  { id: 'uttar-dinajpur', name: 'Uttar Dinajpur', lat: 25.62, lon: 88.12, h: { heat: 0.66, flood: 0.62, cyclone: 0.08, salinity: 0.01, landslide: 0.03 },
    localities: [['Raiganj', 25.62, 88.12], ['Islampur', 26.27, 88.2], ['Dalkhola', 25.88, 87.84], ['Kaliaganj', 25.63, 88.32]] },
  { id: 'dakshin-dinajpur', name: 'Dakshin Dinajpur', lat: 25.22, lon: 88.77, h: { heat: 0.68, flood: 0.55, cyclone: 0.08, salinity: 0.01, landslide: 0.02 },
    localities: [['Balurghat', 25.22, 88.77], ['Gangarampur', 25.4, 88.52], ['Hili', 25.28, 88.99]] },
  { id: 'darjeeling', name: 'Darjeeling', lat: 27.041, lon: 88.2663, h: { heat: 0.2, flood: 0.35, cyclone: 0.05, salinity: 0.0, landslide: 0.88 },
    localities: [['Darjeeling', 27.041, 88.2663], ['Siliguri', 26.7271, 88.3953], ['Kurseong', 26.88, 88.28], ['Mirik', 26.887, 88.187]] },
  { id: 'kalimpong', name: 'Kalimpong', lat: 27.06, lon: 88.47, h: { heat: 0.15, flood: 0.3, cyclone: 0.05, salinity: 0.0, landslide: 0.9 },
    localities: [['Kalimpong', 27.06, 88.47], ['Lava', 27.086, 88.66], ['Gorubathan', 26.97, 88.7]] },
  { id: 'jalpaiguri', name: 'Jalpaiguri', lat: 26.5167, lon: 88.7167, h: { heat: 0.45, flood: 0.75, cyclone: 0.06, salinity: 0.0, landslide: 0.35 },
    localities: [['Jalpaiguri', 26.5167, 88.7167], ['Mal', 26.86, 88.74], ['Dhupguri', 26.59, 89.01], ['Maynaguri', 26.57, 88.82]] },
  { id: 'alipurduar', name: 'Alipurduar', lat: 26.49, lon: 89.53, h: { heat: 0.42, flood: 0.72, cyclone: 0.06, salinity: 0.0, landslide: 0.3 },
    localities: [['Alipurduar', 26.49, 89.53], ['Falakata', 26.52, 89.2], ['Jaigaon', 26.85, 89.38], ['Kumargram', 26.63, 89.82]] },
  { id: 'cooch-behar', name: 'Cooch Behar', lat: 26.324, lon: 89.451, h: { heat: 0.48, flood: 0.7, cyclone: 0.08, salinity: 0.0, landslide: 0.05 },
    localities: [['Cooch Behar', 26.324, 89.451], ['Dinhata', 26.13, 89.47], ['Mathabhanga', 26.34, 89.22], ['Tufanganj', 26.32, 89.67]] },
  { id: 'purba-bardhaman', name: 'Purba Bardhaman', lat: 23.2324, lon: 87.8615, h: { heat: 0.8, flood: 0.55, cyclone: 0.2, salinity: 0.02, landslide: 0.02 },
    localities: [['Bardhaman', 23.2324, 87.8615], ['Kalna', 23.22, 88.36], ['Katwa', 23.65, 88.13], ['Memari', 23.18, 88.11]] },
  { id: 'paschim-bardhaman', name: 'Paschim Bardhaman', lat: 23.6, lon: 87.1, h: { heat: 0.88, flood: 0.3, cyclone: 0.12, salinity: 0.0, landslide: 0.1 },
    localities: [['Asansol', 23.6739, 86.9524], ['Durgapur', 23.5204, 87.3119], ['Raniganj', 23.62, 87.13], ['Kulti', 23.73, 86.85]] },
  { id: 'birbhum', name: 'Birbhum', lat: 23.9, lon: 87.6, h: { heat: 0.85, flood: 0.45, cyclone: 0.12, salinity: 0.0, landslide: 0.03 },
    localities: [['Suri', 23.91, 87.53], ['Bolpur', 23.67, 87.72], ['Santiniketan', 23.68, 87.68], ['Rampurhat', 24.17, 87.78]] },
  { id: 'bankura', name: 'Bankura', lat: 23.23, lon: 87.07, h: { heat: 0.9, flood: 0.35, cyclone: 0.15, salinity: 0.0, landslide: 0.06 },
    localities: [['Bankura', 23.23, 87.07], ['Bishnupur', 23.07, 87.32], ['Sonamukhi', 23.3, 87.42], ['Khatra', 22.98, 86.85]] },
  { id: 'purulia', name: 'Purulia', lat: 23.33, lon: 86.36, h: { heat: 0.95, flood: 0.2, cyclone: 0.1, salinity: 0.0, landslide: 0.12 },
    localities: [['Purulia', 23.33, 86.36], ['Jhalda', 23.37, 85.97], ['Raghunathpur', 23.55, 86.67], ['Ayodhya Hills', 23.21, 86.12]] },
  { id: 'jhargram', name: 'Jhargram', lat: 22.45, lon: 86.99, h: { heat: 0.85, flood: 0.35, cyclone: 0.25, salinity: 0.0, landslide: 0.05 },
    localities: [['Jhargram', 22.45, 86.99], ['Gopiballavpur', 22.2, 86.9], ['Belpahari', 22.63, 86.78]] },
  { id: 'paschim-medinipur', name: 'Paschim Medinipur', lat: 22.42, lon: 87.32, h: { heat: 0.82, flood: 0.62, cyclone: 0.35, salinity: 0.05, landslide: 0.03 },
    localities: [['Medinipur', 22.42, 87.32], ['Kharagpur', 22.346, 87.232], ['Ghatal', 22.66, 87.72], ['Daspur', 22.6, 87.73]] },
  { id: 'purba-medinipur', name: 'Purba Medinipur', lat: 22.0, lon: 87.8, h: { heat: 0.62, flood: 0.72, cyclone: 0.85, salinity: 0.75, landslide: 0.01 },
    localities: [['Tamluk', 22.3, 87.92], ['Haldia', 22.06, 88.06], ['Digha', 21.627, 87.509], ['Contai', 21.78, 87.75], ['Egra', 21.9, 87.53]] },
];

export const ALL_LOCALITIES = DISTRICTS.flatMap((d) =>
  d.localities.map(([name, lat, lon]) => ({ name, lat, lon, districtId: d.id, district: d.name }))
);

export function getDistrict(idOrName) {
  if (!idOrName) return null;
  const k = String(idOrName).toLowerCase();
  return DISTRICTS.find((d) => d.id === k || d.name.toLowerCase() === k) || null;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestLocality(lat, lon) {
  let best = null;
  for (const l of ALL_LOCALITIES) {
    const d = haversineKm({ lat, lon }, l);
    if (!best || d < best.distanceKm) best = { ...l, distanceKm: d };
  }
  return best;
}

export const WB_BOUNDS = { minLat: 21.5, maxLat: 27.3, minLon: 85.8, maxLon: 89.9 };
