import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { config as dotenvLoad } from "dotenv";

// Load .env from project root so PORT matches the server
dotenvLoad({ path: path.resolve(__dirname, "../.env") });

const serverPort = parseInt(process.env.PORT ?? "3001", 10);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@deploy-oci/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
    },
  },
});
