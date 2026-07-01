# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# ---- Build stage ----
FROM base AS builder

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile

COPY packages/shared-types ./packages/shared-types
RUN pnpm --filter @cloudbox/shared-types build

COPY apps/api ./apps/api
RUN pnpm --filter api build

# Generate Prisma client
RUN pnpm --filter api prisma:generate

# ---- Production image ----
FROM node:20-alpine AS runner

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
