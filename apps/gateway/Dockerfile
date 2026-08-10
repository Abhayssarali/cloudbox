# syntax=docker/dockerfile:1
FROM node:20-slim AS base

# Install OpenSSL 1.1.x (required by Prisma 5.x engine)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/gateway/package.json ./apps/gateway/
# Also copy api package.json so pnpm installs prisma CLI (needed for prisma generate)
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile

COPY packages/shared-types ./packages/shared-types
COPY apps/gateway ./apps/gateway
# Copy the shared Prisma schema so we can generate the client
COPY apps/api/prisma ./apps/api/prisma

# Generate Prisma client using the shared schema (must run before build for TypeScript types)
RUN pnpm --filter api run prisma:generate
RUN pnpm --filter @cloudbox/shared-types build
RUN pnpm --filter gateway build

FROM base AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/node_modules ./apps/gateway/node_modules
COPY --from=builder /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=builder /app/apps/gateway/package.json ./apps/gateway/package.json
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
# Copy Prisma schema so gateway can run db push on startup (handles race with API)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 4001

CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema=apps/api/prisma/schema.prisma --skip-generate && node apps/gateway/dist/index.js"]
