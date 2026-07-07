# CloudBox — Monorepo

## Structure

```
cloudbox/
├── apps/
│   ├── api/         # Express.js REST API
│   ├── gateway/     # WebSocket Gateway
│   ├── web/         # Next.js Frontend
│   └── agent/       # Agent (installed on customer Ubuntu machine)
├── packages/
│   └── shared-types/ # Shared TypeScript interfaces
├── docker-compose.yml
├── deploy/          # Nginx, Prometheus, Grafana, Loki, Promtail configs
├── scripts/         # Agent installer and operational scripts
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Getting Started

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose

### Dev Setup

```bash
# Install all dependencies
pnpm install

# Start infrastructure (Postgres + Redis)
docker-compose up -d postgres redis

# Run all apps in dev mode
pnpm dev
```

### Docker Stack

```bash
# Build and run API, Gateway, Web, Postgres, and Redis
docker compose up -d --build

# Include Prometheus, Grafana, Loki, and Promtail
docker compose --profile observability up -d --build
```

Useful local endpoints:
- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Gateway health: `http://localhost:4001/health`
- API metrics: `http://localhost:4000/metrics`
- Gateway metrics: `http://localhost:4001/metrics`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

### Individual Apps

```bash
# API only
pnpm --filter api dev

# Web only
pnpm --filter web dev

# Gateway only
pnpm --filter gateway dev
```

### Health Check

After starting the API: `curl http://localhost:4000/health`
