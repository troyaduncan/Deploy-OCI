import type Database from "better-sqlite3";

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deployments (
      id           TEXT PRIMARY KEY,
      app          TEXT NOT NULL,
      host         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      config       TEXT NOT NULL,
      log          TEXT NOT NULL DEFAULT '',
      started_at   TEXT NOT NULL,
      completed_at TEXT,
      exit_code    INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_deployments_started_at
      ON deployments(started_at DESC);

    CREATE INDEX IF NOT EXISTS idx_deployments_app
      ON deployments(app);
  `);
}
