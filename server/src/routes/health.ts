import { Router } from "express";
import type { Request, Response } from "express";
import { config } from "../config.js";
import fs from "fs";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const scriptExists = fs.existsSync(config.scriptPath);
  res.json({
    status: "ok",
    scriptPath: config.scriptPath,
    scriptExists,
    timestamp: new Date().toISOString(),
  });
});

export default router;
