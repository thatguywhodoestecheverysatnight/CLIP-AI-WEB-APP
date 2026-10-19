# CLIP-AI

**Climate Literacy, Interpretation, Perception and Adaptive Intelligence.**
A mobile-first, 3D-interactive web app that helps people in West Bengal understand local climate risks, read official warnings, share what they see on the ground and act with their community. Every interaction is captured in a structured Postgres database with vector embeddings, ready for research analysis and model training.

---

## 1. What is inside

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite 5, Three.js via React Three Fiber + Drei, hand-built CSS design system |
| Backend | Node.js serverless API (one Vercel function, zero framework), runs identically in local dev |
| Database | PostgreSQL + **pgvector** (Neon, Vercel Postgres, Supabase, RDS or local). Automatic in-memory demo mode when no database is set |
| Weather | Open-Meteo live forecast (free, no key) with deterministic modelled fallback |
| Embeddings | Built-in 96-dimension vectors, no external AI API or cost |

### Respondent journey (matches the CLIP-AI navigation flow)

1. **Onboard**: pick district and locality or use GPS, continue as guest or sign in
2. **Home**: Today's Snapshot, live hourly temperatures, a 3D "climate twin" of the delta that rains, floods and heats up with today's risk, six risk cards (heat, rainfall, flood, cyclone, salinity, landslide)
3. **Learn**: 10 topics with category filters, bookmarks, lesson tracking and server-scored quizzes, including Climate-Responsive Architecture
   - **Climate Home Lab (3D)**: toggle orientation, chajjas, jaalis, cross-ventilation, cool or green roof, courtyard, raised plinth, rainwater harvesting and shade trees on a live 3D house with sun path, breeze particles and a flood simulation
4. **Interpret**: IMD colour-coded example warnings, "what this means locally", interpretation quiz
5. **Perceive**: severity (faces), household vulnerability, trust in information and urgency to act, per hazard
6. **Report / Comment**: description (500 chars), photo (compressed on device, EXIF stripped), tags, GPS geotag, issue type, live "reports from your district today", 3D community pulse map, upvotes, AI similar-report matching
7. **Adapt**: official guidance banner, risk-aware recommended actions, preparedness checklist, long-term adaptation tips
8. **Dashboard (Me)**: CLIP-AI Index with 3D gem, radar breakdown, pillar bars, 4-week trend with target line, journey tracker, recent activity, history, share, export or delete my data

Plus a **Research console** (`/#/admin`): KPIs, average index, perception averages, district and event breakdowns, table browser, a 3D PCA view of the vector store with nearest-neighbour search, and one-click exports (CSV, JSONL, JSON).

### CLIP-AI Index (0 to 100 per pillar)

- **Literacy** = lessons completed (60) + quiz accuracy (40)
- **Interpretation** = best score per warning, weighted by how many warnings were practised
- **Perception** = hazards rated (40) + calibration against the district's baseline risk and completeness of ratings (60)
- **Adaptive Intelligence** = checklist (40) + committed actions (25) + reports filed (20) + Home Lab design (15)
- **Overall** = mean of the four. A snapshot is stored every time the score changes, which powers the trend chart.

---

## 2. Deploy to Vercel (about 10 minutes)

### Step 1. Create the database
Use any Postgres. The simplest is **Neon** (free tier, pgvector built in):
1. Create a project at neon.tech and copy the **pooled** connection string.
2. Or in Vercel: *Storage > Create Database > Neon (Postgres)* and connect it to the project. Vercel then injects `DATABASE_URL` / `POSTGRES_URL` for you.

Tables, indexes and the `vector` extension are created automatically on the first API request. To do it up front instead, run `DATABASE_URL=... npm run db:migrate`, or execute `server/db/schema.sql`.

### Step 2. Deploy
**Option A, Vercel dashboard (no CLI)**
1. Unzip this folder and push it to a new GitHub repository.
2. In Vercel: *Add New > Project > Import* the repo. The framework is detected as **Vite**, and `vercel.json` already sets the build.
3. Add the environment variables below, then **Deploy**.

**Option B, Vercel CLI**
```bash
npm i -g vercel
cd clip-ai
vercel            # first deploy, answer the prompts
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
vercel env add ADMIN_KEY
vercel --prod
```

### Step 3. Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes for persistence | Postgres connection string. Without it the app runs in in-memory demo mode |
| `AUTH_SECRET` | Yes | Signs session tokens. `openssl rand -hex 32` |
| `ADMIN_KEY` | Yes for research console | Protects `/#/admin` and `/api/admin/*`. Console is disabled on Vercel if unset |
| `CORS_ORIGIN` | No | Lock the API to your domain |
| `WEATHER_PROVIDER` | No | `off` disables the Open-Meteo call |
| `PG_POOL_MAX` | No | Connections per function instance (default 3) |

### Step 4. Verify
- `https://your-app.vercel.app/api/health` should show `"db":"postgres","vector":"pgvector"`.
- Open the app, onboard, submit a report, then open `/#/admin` with your `ADMIN_KEY`.

---

## 3. Run locally

```bash
npm install
npm run dev                 # app + API on http://localhost:5173 (in-memory DB)
```
With Postgres:
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/clipai PGSSL=disable npm run dev
```
Production build served by Node (for Render, Railway, a VM or Docker):
```bash
npm run build && npm start  # http://localhost:3000
```
End-to-end API test (25 checks, uses whichever DB is configured):
```bash
npm run test:api
```
Local research console key in demo mode: `dev-admin`.

---

## 4. Data model

| Table | What it stores |
|---|---|
| `users` | Guest or registered respondent, district, locality, coordinates, consent, bookmarks, committed actions |
| `events` | Every screen view, dwell time, tap and filter (client telemetry) plus server-written `activity.*` events |
| `lesson_progress` | Per topic: opened count, time spent, completion, quiz answers and best score |
| `interpretations` | Each IMD warning exercise: answers, score, time taken |
| `perceptions` | Severity, vulnerability, trust, urgency (1 to 5) per hazard, with the weather context at the time |
| `reports` | Description, issue type, tags, photo, GPS, district, upvotes, weather context |
| `checklist` | Preparedness checklist state |
| `lab_sessions` | Each Home Lab design and its computed metrics |
| `index_snapshots` | CLIP-AI Index history (powers the trend) |
| `embeddings` | `vector(96)` per user profile, report and perception, plus named features as JSONB |

### Embedding layout (96 dims, no external API)
- Dims 0 to 31: structured features (index pillars, ratings, hazard one-hots, normalised location, district hazard baselines, weather at time of entry, time of day and season). The exact layout per entity is served at `/api/admin/schema` and documented in `server/embeddings.js`.
- Dims 32 to 95: signed feature-hashing text embedding (unigrams and bigrams, FNV-1a, L2 normalised) of report and comment text.

pgvector gives cosine similarity search (`<=>`) with an HNSW index. It powers "similar reports nearby" for respondents and nearest-neighbour search in the console. To swap in a semantic model later, replace `textEmbedding()` in `server/embeddings.js` and call `POST /api/admin/recompute`.

### Using the data for training
```python
import pandas as pd, numpy as np, requests
H = {"X-Admin-Key": "YOUR_ADMIN_KEY"}
base = "https://your-app.vercel.app/api/admin/export"
reports = pd.read_json(requests.get(f"{base}?dataset=reports&format=jsonl", headers=H).text, lines=True)
emb = pd.read_json(requests.get(f"{base}?dataset=embeddings&format=jsonl", headers=H).text, lines=True)
X = np.vstack(emb.embedding.values)          # (n, 96) ready for clustering or a classifier
features = pd.json_normalize(emb.features)   # same data as named tabular columns
```
Or query Postgres directly, e.g. `SELECT entity_id, embedding <=> (SELECT embedding FROM embeddings WHERE entity_id = '...') AS dist FROM embeddings ORDER BY dist LIMIT 10;`

---

## 5. API reference (all under `/api`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | DB mode, vector mode, config status |
| GET | `/weather?lat&lon&district` | Live or modelled weather plus computed risks |
| POST | `/auth/guest` | Creates or resumes a guest by device id |
| POST | `/auth/register` | Upgrades the current guest to an account, keeping all data |
| POST | `/auth/login` | Signs in and merges this device's guest data |
| GET / PATCH / DELETE | `/me` | Profile, index, trend, activity. DELETE erases everything |
| GET | `/me/export` | All of my data as JSON |
| POST | `/events` | Batched telemetry (also accepts `sendBeacon`) |
| POST | `/learn/progress` | Open, time spent, quiz answers (scored on the server) |
| POST | `/bookmarks` | Save or unsave a topic |
| POST | `/interpret` | Warning exercise answers (scored on the server) |
| POST | `/perceive` | 1 to 6 hazard ratings with context |
| GET / POST | `/reports` | District feed (coordinates coarsened to about 100 m) or submit a report |
| GET | `/reports/stats?district` | Today's count, totals and 30-day mix |
| GET | `/reports/:id/photo` | Report image |
| POST | `/reports/:id/upvote` | Upvote |
| POST | `/checklist`, `/actions`, `/lab` | Adapt and Home Lab |
| GET | `/score` | Index and trend only |
| GET | `/admin/stats`, `/admin/schema`, `/admin/table`, `/admin/export`, `/admin/vectors`, `/admin/similar` | Research console (header `X-Admin-Key`) |
| POST | `/admin/recompute` | Rebuild every index and profile vector |

---

## 6. Engineering notes

- **Offline-first writes**: if the network drops, reports, ratings and checklist changes are queued on the device and synced on reconnect.
- **Security**: scrypt password hashing, HMAC-signed tokens, constant-time key checks, parameterised SQL with column whitelists, input validation and size limits, per-IP rate limiting, no password hash or exact GPS in public responses.
- **Privacy**: GPS only stored with a report, EXIF stripped from photos, consent checkbox at sign-up, self-service export and delete.
- **Performance**: 3D chunks are lazy-loaded, canvases pause when offscreen or the tab is hidden, WebGL failures fall back gracefully, single API function keeps cold starts low.
- **Accessibility**: semantic buttons and roles, keyboard escape on sheets, reduced-motion support.

### Project layout
```
api/index.js            Vercel function entry (all /api routes)
server/router.js        Routes and handlers
server/db/              schema.js (single source of truth), pg.js, memory.js, schema.sql
server/embeddings.js    Feature vectors, text hashing, PCA
server/weather.js       Open-Meteo client with cache and fallback
server/service.js       Index computation, trend, activity
shared/                 Locations, risk model, learning content, index formula (used by client and server)
src/screens/            Welcome, Home, Learn, Interpret, Perceive, Report, Adapt, Dashboard, Lab, Admin
src/three/              DeltaScene, HouseLab, PulseMap, EmbeddingSpace, IndexGem, Backdrop
```

### Notes on content
IMD warnings in Interpret are realistic practice examples, not live alerts. The app links to mausam.imd.gov.in for official warnings. District hazard baselines in `shared/locations.js` are planning-grade approximations and can be replaced with official vulnerability atlas values. Home Lab figures are indicative passive-design estimates for a warm-humid climate.
