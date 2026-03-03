import { Router } from "express";
import type { Request, Response } from "express";
import {
  streamDeployment,
  removeStreamClient,
} from "../services/deploymentService.js";
import { getDeploymentById } from "../services/historyService.js";
import type { SseEvent } from "@deploy-oci/shared";

const router = Router();

// GET /api/deployments/:id/stream — SSE log stream
router.get("/:id/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Keep-alive ping every 15 seconds
  const pingInterval = setInterval(() => {
    res.write(": ping\n\n");
  }, 15_000);

  const client = {
    write: (data: string) => res.write(data),
    end: () => {
      clearInterval(pingInterval);
      res.end();
    },
  };

  const isActive = streamDeployment(req.params.id, client);

  if (!isActive) {
    // Deployment already complete — replay log from DB and close
    const record = getDeploymentById(req.params.id);
    clearInterval(pingInterval);

    if (!record) {
      const errEvent: SseEvent = {
        type: "error",
        message: "Deployment not found",
      };
      res.write(`data: ${JSON.stringify(errEvent)}\n\n`);
      res.end();
      return;
    }

    // Replay saved log lines
    if (record.log) {
      for (const raw of record.log.split("\n")) {
        if (!raw.trim()) continue;
        try {
          const parsed = JSON.parse(raw) as {
            line: string;
            stream: "stdout" | "stderr";
            timestamp: string;
          };
          const event: SseEvent = { type: "log", ...parsed };
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
          // skip malformed entries
        }
      }
    }

    const completeEvent: SseEvent = {
      type: "complete",
      status: record.status === "success" ? "success" : "failed",
      exitCode: record.exitCode ?? 1,
    };
    res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
    res.end();
    return;
  }

  req.on("close", () => {
    clearInterval(pingInterval);
    removeStreamClient(req.params.id, client);
  });
});

export default router;
