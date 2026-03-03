import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  startDeployment,
  cancelDeployment,
} from "../services/deploymentService.js";
import {
  getDeployments,
  getDeploymentById,
  deleteDeployment,
} from "../services/historyService.js";

const router = Router();

const DeploymentConfigSchema = z.object({
  app: z.string().min(1, "App name is required"),
  host: z.string().min(1, "Host is required"),
  remoteUser: z.string().default("adm_tduncan28"),
  sshPort: z.number().int().min(1).max(65535).default(22),
  sshKeepalive: z.number().int().min(0).default(20),
  sshKeepaliveCount: z.number().int().min(0).default(6),
  projectsDir: z.string().default("~/projects"),
  remoteDir: z.string().default(""),
  port: z.string().default("8080:8080"),
  envFile: z.string().default(""),
  engine: z.enum(["podman", "docker"]).default("podman"),
  tag: z.string().default("latest"),
  restartPolicy: z.string().default("always"),
  useSystemd: z.boolean().default(false),
  systemdScope: z.enum(["auto", "user", "system"]).default("auto"),
  enableLinger: z.boolean().default(false),
  rollback: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  transfer: z.enum(["rsync", "scp"]).default("rsync"),
  retries: z.number().int().min(0).default(2),
  keepArchives: z.number().int().min(0).default(5),
  keepImages: z.number().int().min(0).default(3),
});

// POST /api/deployments — start a new deployment
router.post("/", (req: Request, res: Response) => {
  const result = DeploymentConfigSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "Invalid configuration",
      details: result.error.flatten(),
    });
    return;
  }

  const id = startDeployment(result.data);
  res.status(202).json({ id });
});

// GET /api/deployments — list deployment history
router.get("/", (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit ?? "20"), 10))
  );
  const app = req.query.app ? String(req.query.app) : undefined;

  const result = getDeployments({ page, limit, app });
  res.json(result);
});

// GET /api/deployments/:id — single deployment record
router.get("/:id", (req: Request, res: Response) => {
  const record = getDeploymentById(req.params.id);
  if (!record) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }
  res.json(record);
});

// DELETE /api/deployments/:id — cancel active deployment or delete record
router.delete("/:id", (req: Request, res: Response) => {
  const cancelled = cancelDeployment(req.params.id);
  if (cancelled) {
    res.json({ cancelled: true });
    return;
  }

  // Not active — delete from history
  const deleted = deleteDeployment(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }
  res.json({ deleted: true });
});

export default router;
