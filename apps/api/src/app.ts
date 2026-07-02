import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import session from "express-session";
import { passport } from "./lib/passport.js";

import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { agentsRouter } from "./routes/agents.js";

const app: Express = express();

// ---- Security & Middleware ----
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
    credentials: true, // required for httpOnly cookies cross-origin
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session — only used for OAuth state handshake, not for user auth
app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "dev-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env["NODE_ENV"] === "production",
      httpOnly: true,
      maxAge: 10 * 60 * 1000, // 10 minutes — just long enough for OAuth flow
    },
  })
);

// Passport — only initialise, no persistent session (we use JWT cookies instead)
app.use(passport.initialize());

// Logging — skip in test env
if (process.env["NODE_ENV"] !== "test") {
  app.use(morgan("dev"));
}

// ---- Routes ----
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/agents", agentsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
);

export default app;
