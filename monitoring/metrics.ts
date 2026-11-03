// Copy to server/src/metrics.ts, then:  npm install prom-client --prefix server
//
// Wire it up where the Express app is created (before the routes):
//   import { setupMetrics, socketConnections } from "./metrics";
//   setupMetrics(app);
// And in the Socket.IO connection handler:
//   io.on("connection", (socket) => {
//     socketConnections.inc();
//     socket.on("disconnect", () => socketConnections.dec());
//     ...
//   });
//
// /metrics is only reachable inside the cluster: nginx proxies just /api, /uploads, /socket.io.
import type { Express } from "express";
import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "orin_" });

const httpRequests = new client.Counter({
  name: "orin_http_requests_total",
  help: "HTTP requests handled by the ORIN API",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: "orin_http_request_duration_seconds",
  help: "ORIN API request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

export const socketConnections = new client.Gauge({
  name: "orin_socket_connections",
  help: "Currently connected Socket.IO clients",
  registers: [register],
});

export function setupMetrics(app: Express) {
  app.use((req, res, next) => {
    if (req.path === "/metrics") return next();
    const end = httpDuration.startTimer();
    res.on("finish", () => {
      // Use the matched route pattern (e.g. /api/users/:id) to keep label cardinality low
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : "unmatched";
      const labels = { method: req.method, route, status: String(res.statusCode) };
      httpRequests.inc(labels);
      end(labels);
    });
    next();
  });

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });
}
