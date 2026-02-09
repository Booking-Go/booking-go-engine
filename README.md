# Booking.go - Backend Engine

Backend API for **Booking.go** — a multi-tenant SaaS platform for slot-based booking management. Built for small business owners (salons, clinics, gyms, consultants) who need a simple, modern scheduling system.

---

## Tech Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Runtime       | Node.js + TypeScript                |
| Framework     | Express.js                          |
| Primary DB    | PostgreSQL 16 (relational data)     |
| Document DB   | MongoDB 7 (logs, notifications)     |
| Cache         | Redis 7 (sessions, slot caching)    |
| Auth          | JWT (access + refresh tokens)       |
| Validation    | Zod                                 |
| Logging       | Winston                             |
| Containerized | Docker Compose                      |

---

## Project Structure

```
src/
  config/         # Database connections (Postgres, MongoDB, Redis)
  core/
    constants/    # Enums, HTTP status codes, cache keys, app config
    validators/   # Zod schemas per domain
    repositories/ # Data access layer (per domain)
    services/     # Business logic layer (per domain)
  libs/           # Shared utilities (logger, cache, email, hash, JWT)
  middleware/     # Auth, error handler, rate limiter
  models/         # Mongoose models (activity logs, notifications, analytics)
  routes/
    v1/           # Versioned API routes
  types/          # TypeScript type definitions per domain
  server.ts       # Application entry point

docs/             # Design documents
init/             # Database initialization scripts
```

---

## Prerequisites

- **Node.js** >= 18.x
- **Docker** & **Docker Compose** (for databases)
- **npm** >= 9.x

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Booking-Go/booking-go-engine.git
cd booking-go-engine
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values. All variables are documented in `.env.example`.

### 4. Start infrastructure (databases)

```bash
docker compose up -d
```

This starts:

| Service        | Port  | Purpose               |
|----------------|-------|-----------------------|
| PostgreSQL     | 5432  | Primary database      |
| MongoDB        | 27017 | Document storage      |
| Redis          | 6379  | Caching & sessions    |
| pgAdmin        | 5050  | Postgres admin UI     |
| Mongo Express  | 8081  | MongoDB admin UI      |
| RedisInsight   | 5540  | Redis admin UI        |

### 5. Run the development server

```bash
npm run dev
```

Server starts at `http://localhost:8000/api/v1`

---

## Scripts

| Command          | Description                        |
|------------------|------------------------------------|
| `npm run dev`    | Start dev server (nodemon + ts-node) |
| `npm run build`  | Compile TypeScript to `dist/`      |
| `npm start`      | Run compiled production build      |
| `npm test`       | Run tests (Jest)                   |
| `npm run lint`   | Lint source files (ESLint)         |
| `npm run format` | Format source files (Prettier)     |

---

## API

All endpoints are versioned under `/api/v1`. See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for the full API specification.

### Health Check

```
GET /health
```

### Modules

- **Auth** — Register, login, refresh tokens, logout, password reset
- **Users** — Profile management
- **Businesses** — Business CRUD, hours, holidays
- **Services** — Service catalog per business
- **Slots** — Slot generation, availability queries
- **Bookings** — Book, confirm, cancel, complete

---

## Architecture

Layered architecture with strict separation of concerns:

```
Route --> Service --> Repository --> Database
                 \--> Libs (cache, email, logger)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

---

## Documentation

| Document                                          | Description                     |
|---------------------------------------------------|---------------------------------|
| [ARCHITECTURE.md](ARCHITECTURE.md)                | System architecture and design  |
| [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md)| Database schema and relations   |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md)      | API endpoints and contracts     |
| [docs/PROJECT_ROADMAP.md](docs/PROJECT_ROADMAP.md)| Sprint plan and milestones      |

---

## Branch Strategy

| Branch    | Purpose                              |
|-----------|--------------------------------------|
| `main`    | Production releases                  |
| `staging` | Pre-production (PRs from dev)        |
| `dev`     | Active development (PRs from local)  |

Feature branches are created from `dev` and merged back via pull requests.

---

## License

MIT
