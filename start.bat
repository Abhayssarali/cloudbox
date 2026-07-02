@echo off
echo ==================================================
echo Starting CloudBox Local Development Environment...
echo ==================================================
echo.

echo [1/5] Starting Docker Containers (PostgreSQL, Redis)...
docker compose up -d postgres redis
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start Docker containers. Make sure Docker Desktop is running!
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo [2/5] Installing Dependencies...
call pnpm install
echo.

echo [3/5] Generating Prisma Client...
call pnpm --filter api run prisma:generate
echo.

echo [4/5] Running Database Migrations...
call pnpm --filter api run prisma:migrate
echo.

echo [5/5] Starting Development Servers (Frontend, API, etc)...
echo You can access the Web UI at http://localhost:3000
echo You can access the API at http://localhost:4000
echo.
call pnpm dev
