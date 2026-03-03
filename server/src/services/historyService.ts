import { db } from "../db/client.js";
import type { DeploymentRecord } from "@deploy-oci/shared";

interface RawRow {
  id: string;
  app: string;
  host: string;
  status: string;
  config: string;
  log: string;
  started_at: string;
  completed_at: string | null;
  exit_code: number | null;
}

function rowToRecord(row: RawRow): DeploymentRecord {
  return {
    id: row.id,
    app: row.app,
    host: row.host,
    status: row.status as DeploymentRecord["status"],
    config: JSON.parse(row.config),
    log: row.log,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    exitCode: row.exit_code,
  };
}

export function getDeployments(opts: {
  page: number;
  limit: number;
  app?: string;
}): { records: DeploymentRecord[]; total: number } {
  const { page, limit, app } = opts;
  const offset = (page - 1) * limit;

  const whereClause = app ? "WHERE app = ?" : "";
  const params = app ? [app, limit, offset] : [limit, offset];

  const rows = db
    .prepare(
      `SELECT * FROM deployments ${whereClause}
       ORDER BY started_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params) as RawRow[];

  const total = (
    db
      .prepare(`SELECT COUNT(*) as count FROM deployments ${whereClause}`)
      .get(...(app ? [app] : [])) as { count: number }
  ).count;

  return { records: rows.map(rowToRecord), total };
}

export function getDeploymentById(id: string): DeploymentRecord | null {
  const row = db
    .prepare("SELECT * FROM deployments WHERE id = ?")
    .get(id) as RawRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function deleteDeployment(id: string): boolean {
  const result = db
    .prepare("DELETE FROM deployments WHERE id = ?")
    .run(id);
  return result.changes > 0;
}
