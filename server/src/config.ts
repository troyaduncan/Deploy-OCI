import { config as dotenvLoad } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (server/src/../../.env) before reading process.env
dotenvLoad({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  scriptPath:
    process.env.SCRIPT_PATH ??
    path.resolve(__dirname, "../../deploy-oci.sh"),
  dbPath:
    process.env.DB_PATH ??
    path.resolve(__dirname, "../../data/deployments.db"),
  authPassword: process.env.DEPLOY_OCI_AUTH_PASSWORD ?? null,
  isDev: process.env.NODE_ENV !== "production",
  clientDist: path.resolve(__dirname, "../../client/dist"),
};
