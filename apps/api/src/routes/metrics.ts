import { Router, type IRouter } from "express";
import { renderMetrics } from "../lib/metrics.js";

export const metricsRouter: IRouter = Router();

metricsRouter.get("/", (_req, res) => {
  res.type("text/plain; version=0.0.4; charset=utf-8").send(renderMetrics());
});
