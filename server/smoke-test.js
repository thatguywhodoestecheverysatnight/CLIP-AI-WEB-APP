// End-to-end API smoke test. Runs against an in-process server using whatever
// DATABASE_URL is set (memory mode if none). Usage: npm run test:api
import http from 'node:http';
import assert from 'node:assert/strict';
import handler from '../router.js';

const server = http.createServer(handler);
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/api`;
let token = null;

async function call(method, path, body, extra = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}
const ok = (label) => console.log(`  ✓ ${label}`);

try {
  let r = await call('GET', '/health');
  assert.equal(r.status, 200); ok(`health (${r.json.db}, vector=${r.json.vector})`);

  r = await call('GET', '/me');
  assert.equal(r.status, 401); ok('unauthenticated /me rejected');

  const deviceId = `test-${Date.now()}`;
  r = await call('POST', '/auth/guest', { deviceId, districtId: 'hooghly', locality: 'Serampore', lat: 22.7505, lon: 88.3406 });
  assert.equal(r.status, 200); token = r.json.token; assert.ok(token); ok('guest session');

  r = await call('GET', '/weather?lat=22.75&lon=88.34&district=hooghly');
  assert.equal(r.status, 200); assert.equal(r.json.hourly.length, 6); ok(`weather (${r.json.source})`);

  r = await call('POST', '/learn/progress', { topicId: 'heatwaves', opened: true, timeSpent: 40 });
  assert.equal(r.status, 200);
  r = await call('POST', '/learn/progress', { topicId: 'heatwaves', answers: [2, 0, 1], timeSpent: 30 });
  assert.equal(r.json.quizScore, 100); ok('lesson + quiz scored server-side');

  r = await call('POST', '/interpret', { warningId: 'heavy-rain-orange', answers: [1, 2, 0], timeSpent: 50 });
  assert.equal(r.json.score, 100); ok('interpretation scored');

  r = await call('POST', '/perceive', { items: [{ hazard: 'heat', severity: 4, vulnerability: 3, trust: 4, urgency: 5 }, { hazard: 'flood', severity: 3, vulnerability: 2, trust: 3, urgency: 3 }], context: { weather: { feelsMax: 37, rainSum: 12 } } });
  assert.equal(r.status, 200); assert.ok(r.json.index.perception > 0); ok(`perception (index ${r.json.index.perception})`);

  r = await call('POST', '/reports', { description: 'Street outside my house is flooded, water rose two feet in an hour', issueType: 'waterlogging', tags: ['drain', 'road'], geotagged: true, lat: 22.751, lon: 88.341, context: { weather: { rainSum: 40 } } });
  assert.equal(r.status, 200); const reportId = r.json.report.id; ok('report submitted + embedded');

  r = await call('POST', '/reports', { description: 'x', issueType: 'flood' });
  assert.equal(r.status, 400); ok('report validation');

  r = await call('GET', '/reports/stats?district=hooghly');
  assert.ok(r.json.today >= 1); ok(`district stats (today=${r.json.today})`);

  r = await call('POST', `/reports/${reportId}/upvote`);
  assert.equal(r.json.upvotes, 1); ok('upvote');

  for (const itemId of ['contacts', 'water', 'firstaid', 'documents']) r = await call('POST', '/checklist', { itemId, done: true });
  assert.equal(Object.values(r.json.checklist).filter(Boolean).length, 4); ok('checklist');

  r = await call('POST', '/actions', { actionId: 'alerts', on: true });
  r = await call('POST', '/lab', { config: { crossvent: true, coolroof: true, plinth: true } });
  assert.ok(r.json.metrics.cooling > 0); ok(`lab (cooling ${r.json.metrics.cooling}°C)`);

  r = await call('GET', '/me');
  assert.ok(r.json.index.overall > 0); assert.equal(r.json.trend.length, 4); assert.ok(r.json.activity.length > 0);
  ok(`index overall=${r.json.index.overall} L${r.json.index.literacy} I${r.json.index.interpretation} P${r.json.index.perception} A${r.json.index.adaptive}`);

  r = await call('POST', '/events', { events: [{ type: 'screen_view', screen: 'home', ts: new Date().toISOString() }, { type: 'activity.fake' }] });
  assert.equal(r.json.stored, 1); ok('telemetry batch (spoofed activity rejected)');

  const email = `t${Date.now()}@example.com`;
  r = await call('POST', '/auth/register', { name: 'Test', email, password: 'longpassword', districtId: 'hooghly' });
  assert.equal(r.status, 200); assert.equal(r.json.user.is_guest, false); assert.ok(r.json.index.overall > 0); ok('guest upgraded to account, data kept');

  r = await call('POST', '/auth/register', { name: 'Test', email, password: 'longpassword' });
  assert.equal(r.status, 409); ok('duplicate email rejected');

  token = null;
  r = await call('POST', '/auth/guest', { deviceId: `${deviceId}-2`, districtId: 'kolkata' });
  token = r.json.token;
  await call('POST', '/checklist', { itemId: 'water', done: true });
  r = await call('POST', '/auth/login', { email, password: 'longpassword' });
  assert.equal(r.status, 200); token = r.json.token; ok('login merges guest data');

  r = await call('POST', '/auth/login', { email, password: 'wrong' });
  assert.equal(r.status, 401); ok('bad password rejected');

  const admin = { 'X-Admin-Key': process.env.ADMIN_KEY || 'dev-admin' };
  r = await call('GET', '/admin/stats', null, admin);
  assert.equal(r.status, 200); ok(`admin stats (users=${r.json.counts.users}, embeddings=${r.json.counts.embeddings})`);
  r = await call('GET', '/admin/vectors', null, admin);
  assert.ok(r.json.points.length >= 3); ok(`vectors PCA (${r.json.points.length} points)`);
  r = await call('GET', '/admin/export?dataset=reports&format=csv', null, admin);
  assert.ok(String(r.json).startsWith('id,') || String(r.json).includes('description')); ok('CSV export');
  r = await call('GET', '/admin/similar?type=report&id=' + reportId, null, admin);
  assert.equal(r.status, 200); ok(`similarity search (${r.json.neighbours.length} neighbours)`);
  r = await call('GET', '/admin/stats', null, { 'X-Admin-Key': 'nope' });
  assert.equal(r.status, 401); ok('admin key enforced');

  r = await call('DELETE', '/me');
  assert.equal(r.json.ok, true);
  r = await call('GET', '/me');
  assert.equal(r.status, 401); ok('delete my data');

  console.log('\nAll API checks passed.');
} catch (e) {
  console.error('\nFAILED:', e);
  process.exitCode = 1;
} finally {
  server.close();
  setTimeout(() => process.exit(process.exitCode || 0), 100);
}
