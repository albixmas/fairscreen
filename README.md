# FairScreen — Intelligent CV Screening

Production-ready UK CV screening platform with transparent, deterministic scoring. Built with Apple-style UI quality: minimal, elegant, high-contrast typography, lots of whitespace, subtle shadows.

## Architecture

FairScreen separates three concerns:

1. **LLM Extraction** — Unstructured CV text → strict JSON + evidence spans
2. **Deterministic Scoring Engine** — JSON → ladder scores (1–5) → weighted axes (0–25) → percentiles
3. **Policy Layer** — Thresholds + toggles → zone assignment + hiring zone pass

```
/apps/web          → Next.js 14 App Router (UI + API)
/packages/db       → Prisma schema + PostgreSQL
/packages/scoring  → Deterministic scoring engine + tests
/packages/extraction → LLM extraction client (OpenAI-compatible + mock)
/packages/shared   → Types, Zod schemas, enums
/packages/worker   → BullMQ job processors
/scripts           → Seed and demo data generators
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### 1. Clone and install

```bash
git clone <repo-url> fairscreen
cd fairscreen
npm install
```

### 2. Environment setup

```bash
cp .env.example .env
```

Edit `.env` with your database and Redis URLs:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fairscreen?schema=public"
REDIS_URL="redis://localhost:6379"
```

### 3. Database setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Or use migrations for production
npm run db:migrate
```

### 4. Start the application

In separate terminals:

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start background worker
npm run worker
```

The app will be available at **http://localhost:3000**

### 5. Load demo data

Click the **"Load Demo Dataset"** button on the Dashboard page. This seeds:
- 1,500 synthetic candidates with realistic score distributions
- UK university, employer, and division taxonomies
- Default policy with UK_BA cutoffs
- Full cohort statistics and zone assignments

## UI Pages

| Route | Description |
|---|---|
| `/dashboard` | Matrix hero, zone counts, top candidates, score ranges |
| `/upload` | Drag & drop CV upload (PDF/DOCX), processing queue |
| `/candidates` | Searchable candidate table with filters and pagination |
| `/candidates/:id` | Full profile: scores, summary, evidence, audit trail |
| `/hiring-zone` | Policy builder: axis sliders, percentile toggles, capacity target, live preview |
| `/admin/taxonomies` | Editable university tiers, employer families, division rules |
| `/admin/fairness` | Selection rates by tier, 4/5ths rule, false negative sampler |

## Scoring Rubric (UK_BA)

### Educational Readiness (0–25)

| Code | Subcategory | Weight |
|---|---|---|
| E1 | Institution Strength | 30% |
| E2 | Degree Performance | 30% |
| E3 | Master's Signal (MBA excluded) | 10% |
| E4 | Academic Excellence | 20% |
| E5 | University Engagement | 10% |

### Career & Leadership Readiness (0–25)

| Code | Subcategory | Weight |
|---|---|---|
| C1 | Career Experience Quality | 40% |
| C2 | Leadership Potential | 25% |
| C3 | Entrepreneurial Mindset | 20% |
| C4 | Non-Academic Excellence | 10% |
| C5 | Distinction Signal | 5% |

### Decision Zones

- **Strong Yes**: edu ≥ 18 AND career ≥ 18
- **Yes**: (edu ≥ 15 AND career ≥ 15) with at least one axis ≥ 15
- **Maybe**: edu ≥ 10 AND career ≥ 10
- **No**: below thresholds
- **Pre-screen Fail**: does not meet minimum requirements

### Pre-screen (UK_BA defaults)

- Minimum degree class: 2:1
- Maximum YOE: 24 months
- Qualifying internship: ≥ 6 weeks

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Upload CV files |
| GET | `/api/upload` | List uploaded files |
| GET | `/api/candidates` | Paginated candidate list (filters: search, zone) |
| GET | `/api/candidates/:id` | Full candidate detail |
| GET | `/api/stats?type=overview` | Dashboard stats |
| GET | `/api/stats?type=matrix` | Matrix plot data |
| GET | `/api/stats?type=distributions` | Cohort distributions |
| GET | `/api/stats?type=fairness` | Fairness audit data |
| POST | `/api/policy` (action=preview) | Preview policy impact |
| POST | `/api/policy` (action=save) | Save policy version |
| GET | `/api/policy` | List policy versions |
| GET | `/api/export?type=shortlist&format=csv` | Export shortlist CSV |
| GET | `/api/export?type=audit&format=json` | Export audit log |
| GET/POST | `/api/admin` | Taxonomy CRUD |
| POST | `/api/demo` | Seed demo dataset |

## Editing Taxonomies

### University tiers

Edit in the Admin → Taxonomies UI or directly in the database `UniversityTaxonomy` table. Default tiers are seeded with the demo data.

### Employer families

Edit via Admin → Taxonomies → Employers tab. Families are mapped to ELITE, SELECTIVE, or OTHER tiers.

### Division/role mapping

Edit via Admin → Taxonomies → Divisions tab. Each family has division rules with category, keywords, and selectivity multipliers. E.g., `Strategy& → STRATEGY → multiplier 1.0` vs `Audit → AUDIT → multiplier 0.4`.

### Policy defaults

Edit weights and cutoffs via the Hiring Zone Builder UI. Save as named PolicyVersions for auditability.

## Tests

```bash
# Run scoring engine tests
cd packages/scoring && npx vitest run

# Run all workspace tests
npm test
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Required |
| `LLM_API_KEY` | OpenAI-compatible API key | Optional (mock provider used without it) |
| `LLM_API_BASE_URL` | LLM API base URL | `https://api.openai.com/v1` |
| `LLM_MODEL` | Model name for extraction | `gpt-4o` |
| `STORAGE_TYPE` | File storage type | `local` |
| `STORAGE_LOCAL_PATH` | Local upload directory | `./uploads` |
| `NEXTAUTH_SECRET` | Auth secret key | Required for auth |
| `NODE_ENV` | Environment | `development` |

## License

Private — all rights reserved.
