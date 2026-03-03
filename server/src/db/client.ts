import Database, { type Database as DatabaseType } from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { initializeSchema } from "./schema.js";

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: DatabaseType = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

initializeSchema(db);
