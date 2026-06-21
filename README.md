# OmniPOS

Multi-tenant, offline-first cloud POS platform for Sri Lanka.

## Architecture

```
omnipos/
├── apps/
│   ├── api/          NestJS REST API          → :3000
│   ├── dashboard/    Next.js admin dashboard  → :3001
│   └── pos/          Flutter POS app          (Android · Windows · Web)
├── packages/
│   └── types/        Shared TypeScript types
├── docker-compose.yml   PostgreSQL 16 + Redis 7
└── .env.example
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| Docker + Docker Compose | any recent |
| Flutter SDK | ≥ 3.22 |

## Quick Start

### 1 — Start infrastructure

```bash
docker compose up -d
```

Starts **PostgreSQL 16** on `:5432` and **Redis 7** on `:6379`.

### 2 — Environment

```bash
cp .env.example .env
# Edit .env if needed — defaults work for local dev as-is
```

### 3 — Install and bootstrap

```bash
npm install                         # installs all workspaces
npm run build -w packages/types     # compile shared types first
npm run db:generate -w apps/api     # generate Prisma client
npm run migrate -w apps/api         # create DB tables
```

Or with Make:

```bash
make setup     # runs all of the above
```

### 4 — Start dev servers

```bash
npm run dev
# or
make dev
```

| Service | URL |
|---------|-----|
| API root | http://localhost:3000 |
| API health | http://localhost:3000/health |
| Dashboard | http://localhost:3001 |

### 5 — Flutter POS app

> The Flutter project needs its native platform files generated once:

```bash
cd apps/pos
flutter create . --org com.omnipos --project-name omnipos --platforms android,windows,web
flutter pub get
```

Then run on your target platform:

```bash
# Web browser
flutter run -d chrome

# Android (device/emulator attached)
flutter run -d android

# Windows desktop
flutter run -d windows
```

You will see the **"Hello OmniPOS"** welcome screen.

---

## Available Commands

### npm scripts (root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Dashboard in watch mode |
| `npm run build` | Build all TypeScript apps |
| `npm run test` | Run API unit tests |
| `npm run migrate` | Run Prisma dev migration |
| `npm run lint` | Lint all TypeScript workspaces |
| `npm run format` | Format with Prettier |

### Make targets

| Target | Description |
|--------|-------------|
| `make infra-up` | Start Postgres + Redis |
| `make infra-down` | Stop containers |
| `make infra-reset` | Destroy containers and volumes |
| `make setup` | Full first-time setup |
| `make dev` | Start infrastructure + dev servers |
| `make build` | Build all apps |
| `make test` | Run tests |
| `make migrate` | Run DB migrations |
| `make lint` | Lint |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API name + version |
| GET | `/health` | DB connectivity + uptime |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Token signing secret |
| `JWT_EXPIRES_IN` | Access token lifetime (e.g. `7d`) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (e.g. `30d`) |
| `API_PORT` | API listen port (default `3000`) |
| `NODE_ENV` | `development` / `production` / `test` |
| `NEXT_PUBLIC_API_URL` | API base URL used by the dashboard |

---

## Database

Prisma schema lives at `apps/api/prisma/schema.prisma`.

```bash
# Create a new migration
npm run migrate -w apps/api

# Open Prisma Studio (GUI)
npm run db:studio -w apps/api

# Deploy migrations in CI / production
npm run migrate:deploy -w apps/api
```

---

## Docker (Production)

Each app has its own Dockerfile for containerised deployment:

```bash
# Build from the repo root (context must include packages/)
docker build -f apps/api/Dockerfile       -t omnipos-api .
docker build -f apps/dashboard/Dockerfile -t omnipos-dashboard .
```

---

## CI

GitHub Actions runs on every push/PR to `main` and `develop`:

- **TypeScript job** — installs, generates Prisma client, migrates, lints, builds, and tests (with live Postgres + Redis services)
- **Flutter job** — `flutter pub get`, `flutter analyze`, `flutter test`

See `.github/workflows/ci.yml`.
