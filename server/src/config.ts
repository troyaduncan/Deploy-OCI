import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
