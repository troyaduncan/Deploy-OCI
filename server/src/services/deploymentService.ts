import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import { v4 as uuidv4 } from "uuid";
import type {
  DeploymentConfig,
  SseEvent,
  PipelineStepName,
} from "@deploy-oci/shared";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { buildScriptArgs } from "./argBuilder.js";
import { parseStepFromLine, STEP_ORDER } from "./stepParser.js";

interface ActiveDeployment {
  process: ChildProcess;
  sseClients: Set<{ write: (data: string) => void; end: () => void }>;
  logBuffer: string[];
  lastStep: PipelineStepName | null;
}

const activeDeployments = new Map<string, ActiveDeployment>();

export function startDeployment(deployConfig: DeploymentConfig): string {
  const id = uuidv4();
  const startedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO deployments (id, app, host, status, config, log, started_at)
     VALUES (?, ?, ?, 'running', ?, '', ?)`
  ).run(id, deployConfig.app, deployConfig.host, JSON.stringify(deployConfig), startedAt);

  const args = buildScriptArgs(deployConfig);
  const child = spawn("bash", [config.scriptPath, ...args], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const entry: ActiveDeployment = {
    process: child,
    sseClients: new Set(),
    logBuffer: [],
    lastStep: null,
  };
  activeDeployments.set(id, entry);

  const broadcast = (event: SseEvent) => {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    entry.sseClients.forEach((client) => {
      try {
        client.write(data);
      } catch {
        // client disconnected
      }
    });
  };

  const handleLine = (line: string, stream: "stdout" | "stderr") => {
    const timestamp = new Date().toISOString();
    entry.logBuffer.push(
      JSON.stringify({ line, stream, timestamp })
    );

    broadcast({ type: "log", line, stream, timestamp });

    // Parse step transitions from stdout only
    if (stream === "stdout") {
      const stepEvents = parseStepFromLine(line, entry.lastStep);
      for (const evt of stepEvents) {
        broadcast(evt);
        if (evt.status === "running") {
          entry.lastStep = evt.step;
        }
      }
    }
  };

  const stdoutReader = createInterface({ input: child.stdout! });
  stdoutReader.on("line", (line) => handleLine(line, "stdout"));

  const stderrReader = createInterface({ input: child.stderr! });
  stderrReader.on("line", (line) => handleLine(line, "stderr"));

  child.on("close", (exitCode) => {
    const status = exitCode === 0 ? "success" : "failed";
    const completedAt = new Date().toISOString();

    // Mark the last running step as done or failed
    if (entry.lastStep) {
      const stepStatus = exitCode === 0 ? "done" : "failed";
      broadcast({ type: "step", step: entry.lastStep, status: stepStatus });

      // If success, mark all remaining steps as done
      if (exitCode === 0) {
        const lastIdx = STEP_ORDER.indexOf(entry.lastStep);
        for (let i = lastIdx + 1; i < STEP_ORDER.length; i++) {
          broadcast({
            type: "step",
            step: STEP_ORDER[i],
            status: "skipped",
          });
        }
      }
    }

    const fullLog = entry.logBuffer.join("\n");
    db.prepare(
      `UPDATE deployments
       SET status = ?, log = ?, completed_at = ?, exit_code = ?
       WHERE id = ?`
    ).run(status, fullLog, completedAt, exitCode, id);

    broadcast({
      type: "complete",
      status: exitCode === 0 ? "success" : "failed",
      exitCode: exitCode ?? 1,
    });

    entry.sseClients.forEach((client) => {
      try {
        client.end();
      } catch {
        // ignore
      }
    });
    activeDeployments.delete(id);
  });

  return id;
}

export function streamDeployment(
  id: string,
  client: { write: (data: string) => void; end: () => void }
): boolean {
  const entry = activeDeployments.get(id);
  if (!entry) return false;

  // Replay buffered lines to late-connecting clients
  for (const raw of entry.logBuffer) {
    try {
      const event = JSON.parse(raw) as {
        line: string;
        stream: "stdout" | "stderr";
        timestamp: string;
      };
      const sseEvent: SseEvent = { type: "log", ...event };
      client.write(`data: ${JSON.stringify(sseEvent)}\n\n`);
    } catch {
      // skip malformed buffer entries
    }
  }

  entry.sseClients.add(client);
  return true;
}

export function removeStreamClient(
  id: string,
  client: { write: (data: string) => void; end: () => void }
): void {
  activeDeployments.get(id)?.sseClients.delete(client);
}

export function cancelDeployment(id: string): boolean {
  const entry = activeDeployments.get(id);
  if (!entry) return false;
  entry.process.kill("SIGTERM");
  return true;
}

export function isDeploymentActive(id: string): boolean {
  return activeDeployments.has(id);
}
