# Deploy OCI — Container Deployment Dashboard

A modern web UI for deploying containerized Node.js applications to air-gapped RHEL 9 servers using Podman. Built with React + TypeScript + Vite (frontend) and Node.js + Express (backend), styled with T-Mobile's brand color scheme.

The web app wraps `deploy-oci.sh` — exposing all 25+ deployment options through an intuitive form with real-time log streaming, a 9-step visual pipeline, and deployment history.

---

## Quick Start

### Prerequisites

- Node.js 20+
- `deploy-oci.sh` requirements met on your local machine (podman/docker, rsync/scp, SSH access to target host)

### Install & Run (Development)

```bash
# Install all workspace dependencies
npm install

# Start both server (port 3001) and client (port 5173) with hot-reload
npm run dev
```

Open **http://localhost:5173** in your browser.

### Run in Production

```bash
# Build all packages
npm run build

# Start the production server (serves frontend + API on one port)
npm start
```

Open **http://localhost:3001**.

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Express server port |
| `SCRIPT_PATH` | `./deploy-oci.sh` | Absolute path to deploy-oci.sh |
| `DB_PATH` | `./data/deployments.db` | SQLite database location |
| `DEPLOY_OCI_AUTH_PASSWORD` | *(unset)* | Optional: enable HTTP Basic Auth |

---

## Features

### Deploy Page
- **Deployment form** with all 25+ options organized into 4 collapsible sections:
  - **Target** (always visible): App name + remote host
  - **Connection & Paths**: SSH port, keepalive, user, project directories
  - **Container**: Engine (podman/docker), port mapping, env file, tag, restart policy, transfer method
  - **Advanced**: Systemd service, linger, rollback, archive/image pruning
- **Dry Run mode**: Toggle to preview all actions without making changes
- **9-step visual pipeline**: Real-time progress indicator with icons and status colors
- **Live log streaming**: Server-Sent Events (SSE) stream the deployment output line-by-line as it runs
- **Cancel** button to SIGTERM the running deployment

### History Page
- Paginated table of all past deployments with status badges, duration, and tags
- Click any row to **replay the full deployment log** in a modal
- Delete individual deployment records
- Auto-refreshes every 3 seconds while deployments are running

---

## Architecture & Flow

```
Browser (React)          Express (Node.js)           deploy-oci.sh (bash)
─────────────────────    ────────────────────────    ────────────────────
Fill form + submit  ───► POST /api/deployments  ───► spawn() with args
                         Insert DB record
Connect SSE stream  ◄─── GET /api/deployments/:id/stream
                         ├─ stdout/stderr line ──► broadcast SSE "log" event
Live log appears    ◄─── │
                         ├─ "==>" pattern match ──► broadcast SSE "step" event
Pipeline highlights ◄─── │
                         └─ process.close() ────► broadcast SSE "complete"
Status badge update ◄─── │                         Update DB record
```

### 9-Step Pipeline (from deploy-oci.sh)

| Step | Description |
|------|-------------|
| **Build** | `podman/docker build` image locally from Containerfile |
| **Export** | Save image as OCI archive + SHA256 checksum |
| **Transfer** | rsync (preferred) or scp to remote host with retry |
| **Verify** | SHA256 checksum + tar readability check on remote |
| **Load** | `podman load` image into remote image store |
| **Rootless** | Auto-detect rootless Podman + determine systemd scope |
| **Restart** | Stop old container, start new with port/env-file mapping |
| **Systemd** | Optionally install as systemd user/system service |
| **Pruning** | Remove old archives and unused images from remote |

---

## Project Structure

```
deploy-oci/
├── deploy-oci.sh              # Original bash deployment script (untouched)
├── package.json               # npm workspaces root
├── .env.example               # Environment variable template
├── shared/                    # @deploy-oci/shared — TypeScript types
│   └── src/types.ts           # DeploymentConfig, SSE events, PipelineStep
├── server/                    # Express + TypeScript backend
│   └── src/
│       ├── index.ts           # Entry point; serves API + static files
│       ├── config.ts          # Env var loading
│       ├── db/                # SQLite via better-sqlite3
│       ├── services/
│       │   ├── deploymentService.ts  # spawn(), readline, SSE broadcasting
│       │   ├── argBuilder.ts         # DeploymentConfig → CLI args
│       │   ├── stepParser.ts         # "==>" patterns → pipeline step events
│       │   └── historyService.ts     # Deployment record CRUD
│       └── routes/            # REST API + SSE endpoints
└── client/                    # Vite + React + TypeScript frontend
    └── src/
        ├── pages/             # DeployPage, HistoryPage
        ├── components/
        │   ├── deploy/        # Form sections (Required, Connection, Container, Advanced)
        │   ├── pipeline/      # 9-step visual progress indicator
        │   ├── log/           # DeploymentLog + LogLine with syntax highlighting
        │   └── history/       # HistoryTable + LogModal
        └── lib/               # API client, utilities
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/deployments` | Start a deployment |
| `GET` | `/api/deployments` | List history (query: `page`, `limit`, `app`) |
| `GET` | `/api/deployments/:id` | Get single record |
| `DELETE` | `/api/deployments/:id` | Cancel active or delete record |
| `GET` | `/api/deployments/:id/stream` | SSE log stream |
| `GET` | `/api/health` | Health check + script path validation |

**Start a deployment (POST body example):**
```json
{
  "app": "Team-Nexus",
  "host": "dblvlecdd0000a",
  "remoteUser": "adm_tduncan28",
  "port": "8080:8080",
  "engine": "podman",
  "tag": "latest",
  "useSystemd": true,
  "systemdScope": "auto",
  "enableLinger": true,
  "rollback": true,
  "keepArchives": 5,
  "keepImages": 3,
  "transfer": "rsync",
  "retries": 2,
  "dryRun": false
}
```

---

## Design Principles

1. **Script as black box** — `deploy-oci.sh` is invoked unmodified; the web app maps form fields to CLI args
2. **Real-time feedback** — SSE streams stdout/stderr line-by-line; no polling
3. **Step detection** — `==>` prefixed echo statements in the script map to the 9-step pipeline UI
4. **Always `--yes`** — The web UI injects `--yes` to bypass interactive prompts (dry-run toggle provides the safety net)
5. **SQLite for history** — Zero-config, concurrent-safe, no external database process
6. **T-Mobile brand** — Dark theme (`#111111` background) with magenta (`#E20074`) accents throughout

---

## deploy-oci.sh — Original CLI Reference

The web app wraps `deploy-oci.sh`. You can still use it directly from the command line:

```bash
# Basic interactive deployment
./deploy-oci.sh --app Team-Nexus --host dblvlecdd0000a

# Production-grade: systemd, linger, rollback, skip prompt
./deploy-oci.sh \
  --app Team-Nexus \
  --host dblvlecdd0000a \
  --env-file /home/adm_tduncan28/node/Team-Nexus/Team-Nexus.env \
  --use-systemd --systemd-scope auto --enable-linger \
  --rollback \
  --keep-archives 7 --keep-images 5 \
  --yes

# Preview all actions without making changes
./deploy-oci.sh --app Team-Nexus --host dblvlecdd0000a --dry-run
```

### All Options

**Required:**
- `--app <name>` — App directory name under `--projects-dir`
- `--host <host>` — Target host (DNS or IP)

**Connection:**
- `--remote-user <user>` (default: `adm_tduncan28`)
- `--ssh-port <port>` (default: `22`)
- `--ssh-keepalive <sec>` (default: `20`)
- `--ssh-keepalive-count <N>` (default: `6`)

**Paths:**
- `--projects-dir <dir>` (default: `~/projects`)
- `--remote-dir <dir>` (default: `/home/<user>/node`)

**Container:**
- `--port <host:container>` (default: `8080:8080`)
- `--env-file <remote-path>` — Remote env file for `podman run`
- `--engine <podman|docker>` (default: `podman`)
- `--tag <tag>` (default: `latest`)
- `--restart-policy <policy>` (default: `always`)

**Systemd:**
- `--use-systemd` — Install as a systemd service
- `--systemd-scope <auto|user|system>` (default: `auto`)
- `--enable-linger` — Enable boot-time startup without login (rootless)

**Safety:**
- `--rollback` — Auto-rollback if new container fails to start
- `--yes` — Skip confirmation prompt
- `--dry-run` — Preview all actions, no changes made

**Transfer:**
- `--transfer <rsync|scp>` (default: `rsync`, falls back to scp)
- `--retries <N>` (default: `2`)

**Pruning:**
- `--keep-archives <N>` (default: `5`; `0` disables)
- `--keep-images <N>` (default: `3`; `0` disables)

### Safety & Integrity

- SHA256 computed locally; verified on remote before `podman load`
- `tar -tf` readability check catches truncated archives / unexpected EOF
- `set -euo pipefail` — fails immediately on any error
- Rollback uses existing image in remote store — no re-transfer needed
- SSH keepalives prevent connection drops during large transfers
- Systemd units are stopped/disabled before container removal (prevents race condition where systemd restarts the container between `podman rm` and the new `podman run`)
- Podman builds use `--network=host` for reliable DNS resolution in rootless mode

### Air-Gapped / Corporate Environment Notes

**CA Certificate Injection**: For environments behind corporate TLS inspection proxies, Containerfiles should inject the CA bundle before any network calls (e.g., `npm install`, `pnpm install`):

```dockerfile
COPY deploy/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
```

Place your corporate CA bundle at `<app>/deploy/ca-certificates.crt`. The system CA bundle from `/etc/ssl/certs/ca-certificates.crt` on your build machine typically works.

**Env File Format**: Podman's `--env-file` is strict — no comments, no blank lines, only `KEY=VALUE` lines.

**Systemd + Env Files**: When using `--use-systemd`, the generated systemd unit does not include `--env-file`. After the initial deploy sets up systemd, subsequent restarts via systemd will run without env vars unless you regenerate the unit. To work around this, redeploy with `--use-systemd` after updating the env file.

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Deployment successful |
| `1` | Deployment failed (or rollback attempted) |
