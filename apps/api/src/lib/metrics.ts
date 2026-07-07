import type { NextFunction, Request, Response } from "express";

const startedAt = Date.now();
let totalHttpRequests = 0;
let activeHttpRequests = 0;
let totalHttpErrors = 0;
let requestDurationSecondsSum = 0;

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/metrics") {
    next();
    return;
  }

  const started = process.hrtime.bigint();
  activeHttpRequests += 1;

  res.on("finish", () => {
    const elapsedNs = process.hrtime.bigint() - started;
    const elapsedSeconds = Number(elapsedNs) / 1_000_000_000;

    totalHttpRequests += 1;
    activeHttpRequests = Math.max(0, activeHttpRequests - 1);
    requestDurationSecondsSum += elapsedSeconds;

    if (res.statusCode >= 500) {
      totalHttpErrors += 1;
    }
  });

  next();
}

export function renderMetrics(): string {
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);

  return [
    "# HELP cloudbox_api_uptime_seconds API process uptime in seconds.",
    "# TYPE cloudbox_api_uptime_seconds gauge",
    `cloudbox_api_uptime_seconds ${uptimeSeconds}`,
    "# HELP cloudbox_api_http_requests_total Total HTTP requests served by the API.",
    "# TYPE cloudbox_api_http_requests_total counter",
    `cloudbox_api_http_requests_total ${totalHttpRequests}`,
    "# HELP cloudbox_api_http_errors_total Total API HTTP responses with status code >= 500.",
    "# TYPE cloudbox_api_http_errors_total counter",
    `cloudbox_api_http_errors_total ${totalHttpErrors}`,
    "# HELP cloudbox_api_active_http_requests Active in-flight API HTTP requests.",
    "# TYPE cloudbox_api_active_http_requests gauge",
    `cloudbox_api_active_http_requests ${activeHttpRequests}`,
    "# HELP cloudbox_api_http_request_duration_seconds_sum Total API request duration in seconds.",
    "# TYPE cloudbox_api_http_request_duration_seconds_sum counter",
    `cloudbox_api_http_request_duration_seconds_sum ${requestDurationSecondsSum.toFixed(6)}`,
    "# HELP cloudbox_api_http_request_duration_seconds_count Number of timed API requests.",
    "# TYPE cloudbox_api_http_request_duration_seconds_count counter",
    `cloudbox_api_http_request_duration_seconds_count ${totalHttpRequests}`,
    "",
  ].join("\n");
}
