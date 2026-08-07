@echo off
echo ==================================================
echo Starting CloudBox in Docker Containers...
echo ==================================================
echo.

echo [1/3] Building and starting all containers...
docker compose up -d --build postgres redis api gateway web
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start Docker containers. Make sure Docker Desktop is running!
    pause
    exit /b %ERRORLEVEL%
)
echo.

echo [2/3] Running Database Migrations inside API Container...
docker compose exec api npx prisma migrate deploy
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Prisma migrations did not deploy successfully. Check database state.
)
echo.

echo [3/3] CloudBox Container Stack is Online!
echo.
echo Services running:
echo   - Web UI (Frontend) : http://localhost:3000
echo   - API Server        : http://localhost:4000
echo   - Gateway WebSocket : ws://localhost:4001
echo   - Gateway Health    : http://localhost:4001/health
echo.
echo To view logs, run: docker compose logs -f
echo To stop the stack, run: docker compose down
echo.
echo Note: To connect a storage node, run "pnpm --filter agent run dev start" in a separate terminal.
echo.
pause
