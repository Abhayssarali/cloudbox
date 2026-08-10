# syntax=docker/dockerfile:1
FROM node:20-slim AS base

# Install OpenSSL 1.1.x (required by Prisma 5.x engine)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile

COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api

RUN pnpm --filter api prisma:generate
RUN pnpm --filter @cloudbox/shared-types build
RUN pnpm --filter api build

FROM base AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

EXPOSE 4000

CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema=apps/api/prisma/schema.prisma --skip-generate && node apps/api/dist/index.js"]
