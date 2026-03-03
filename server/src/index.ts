import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import deploymentsRouter from "./routes/deployments.js";
import streamRouter from "./routes/stream.js";
import healthRouter from "./routes/health.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());
app.use(authMiddleware);

// API routes
app.use("/api/health", healthRouter);
app.use("/api/deployments", deploymentsRouter);
app.use("/api/deployments", streamRouter);

// Serve static frontend in production
if (!config.isDev) {
  app.use(express.static(config.clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(config.clientDist, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`Deploy OCI server running on http://localhost:${config.port}`);
  console.log(`Script path: ${config.scriptPath}`);
  console.log(`DB path: ${config.dbPath}`);
  if (config.isDev) {
    console.log("Dev mode: frontend served by Vite on http://localhost:5173");
  }
});
