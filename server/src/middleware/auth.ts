import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!config.authPassword) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Deploy OCI"');
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const encoded = authHeader.slice("Basic ".length);
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const [, password] = decoded.split(":");

  if (password !== config.authPassword) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Deploy OCI"');
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  next();
}
