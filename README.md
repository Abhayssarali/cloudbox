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
