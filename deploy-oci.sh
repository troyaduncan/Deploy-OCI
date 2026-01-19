#!/usr/bin/env bash
set -euo pipefail

# deploy-oci.sh
#
# Build an image locally (podman/docker), export as a single archive, transfer to a remote (air-gapped) RHEL host,
# verify integrity, podman load, restart container, optional systemd integration (user/system), rollback, and pruning.
#
# Highlights
# - Creates a default Containerfile if neither Containerfile nor Dockerfile exists (default CMD: npm start)
# - SSH keepalives + retries; rsync resumable preferred; scp fallback
# - Remote integrity checks: sha256sum -c and tar -tf (catches truncated archives / unexpected EOF)
# - Auto-detects remote podman rootless and chooses systemd scope (user/system) when --systemd-scope auto
# - Optional: enable linger for user services (rootless) with --enable-linger
# - Optional rollback to previous container image ID with --rollback
# - Optional pruning of old remote archives and unused images

usage() {
  cat <<'EOF'
Usage:
  deploy-oci.sh --app <appName> --host <hostname-or-ip> [options]

Required:
  --app <name>                 App directory name under --projects-dir
  --host <host>                Target host (DNS or IP)

Common options:
  --remote-user <user>         SSH user on target (default: adm_tduncan28)
  --projects-dir <dir>         Local base dir (default: ~/projects)
  --remote-dir <dir>           Remote base dir (default: /home/<remote-user>/node)
  --port <host:container>      Port mapping (default: 8080:8080)
  --env-file <remote path>     Remote env file for podman run (optional)
  --engine <podman|docker>     Local build engine (default: podman)
  --tag <tag>                  Image tag (default: latest)
  --yes                        Skip confirmation prompt
  --dry-run                    Print what would happen (no changes)

Systemd:
  --use-systemd
  --systemd-scope <auto|user|system>   default: auto
  --enable-linger                      If user scope and linger is disabled, run sudo loginctl enable-linger

Rollback & pruning:
  --rollback
  --keep-archives <N>          Keep newest N archives on remote (default: 5; 0 disables)
  --keep-images <N>            Keep newest N images for local/<app> on remote (default: 3; 0 disables)

Transfer/SSH:
  --transfer <rsync|scp>       default: rsync (falls back to scp if rsync missing)
  --retries <N>                default: 2
  --ssh-port <port>            default: 22
  --ssh-keepalive <sec>        default: 20
  --ssh-keepalive-count <N>    default: 6

Examples:
  deploy-oci.sh --app Team-Nexus --host dblvlecdd0000a --use-systemd --enable-linger --yes
  deploy-oci.sh --app api --host rhel9 --systemd-scope system --use-systemd
EOF
}

# -------------------------
# Defaults
# -------------------------
APP=""
HOST=""
REMOTE_USER="adm_tduncan28"
PROJECTS_DIR="${HOME}/projects"
REMOTE_DIR=""                 # default set later based on REMOTE_USER
PORT_MAP="8080:8080"
ENV_FILE=""
ENGINE="podman"
TAG="latest"

USE_SYSTEMD="false"
SYSTEMD_SCOPE="auto"          # auto|user|system
ENABLE_LINGER="false"

RESTART_POLICY="always"

TRANSFER="rsync"
RETRIES="2"

SSH_PORT="22"
SSH_KEEPALIVE="20"
SSH_KEEPALIVE_COUNT="6"

KEEP_ARCHIVES="5"
KEEP_IMAGES="3"
DO_ROLLBACK="false"

DRY_RUN="false"
ASSUME_YES="false"

# -------------------------
# Arg parsing
# -------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app) APP="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --remote-user) REMOTE_USER="$2"; shift 2;;
    --projects-dir) PROJECTS_DIR="$2"; shift 2;;
    --remote-dir) REMOTE_DIR="$2"; shift 2;;
    --port) PORT_MAP="$2"; shift 2;;
    --env-file) ENV_FILE="$2"; shift 2;;
    --engine) ENGINE="$2"; shift 2;;
    --tag) TAG="$2"; shift 2;;

    --use-systemd) USE_SYSTEMD="true"; shift 1;;
    --systemd-scope) SYSTEMD_SCOPE="$2"; shift 2;;
    --enable-linger) ENABLE_LINGER="true"; shift 1;;

    --restart-policy) RESTART_POLICY="$2"; shift 2;;

    --transfer) TRANSFER="$2"; shift 2;;
    --retries) RETRIES="$2"; shift 2;;

    --ssh-port) SSH_PORT="$2"; shift 2;;
    --ssh-keepalive) SSH_KEEPALIVE="$2"; shift 2;;
    --ssh-keepalive-count) SSH_KEEPALIVE_COUNT="$2"; shift 2;;

    --keep-archives) KEEP_ARCHIVES="$2"; shift 2;;
    --keep-images) KEEP_IMAGES="$2"; shift 2;;
    --rollback) DO_ROLLBACK="true"; shift 1;;

    --dry-run) DRY_RUN="true"; shift 1;;
    --yes) ASSUME_YES="true"; shift 1;;

    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

if [[ -z "$APP" || -z "$HOST" ]]; then
  echo "ERROR: --app and --host are required."
  usage
  exit 1
fi

if [[ -z "$REMOTE_DIR" ]]; then
  REMOTE_DIR="/home/${REMOTE_USER}/node"
fi

LOCAL_APP_DIR="${PROJECTS_DIR}/${APP}"
if [[ ! -d "$LOCAL_APP_DIR" ]]; then
  echo "ERROR: Local app directory not found: $LOCAL_APP_DIR"
  exit 1
fi

if ! command -v "$ENGINE" >/dev/null 2>&1; then
  echo "ERROR: Local engine '$ENGINE' not found. Install podman or docker on your local machine."
  exit 1
fi

# -------------------------
# Helpers
# -------------------------
SSH_OPTS=(
  -p "$SSH_PORT"
  -o "ServerAliveInterval=${SSH_KEEPALIVE}"
  -o "ServerAliveCountMax=${SSH_KEEPALIVE_COUNT}"
  -o "TCPKeepAlive=yes"
  -o "Compression=yes"
)

print_kv() { printf "  %-18s %s\n" "$1" "$2"; }

run_local() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

ssh_run() {
  local cmd="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] ssh ${REMOTE_USER}@${HOST} $cmd"
  else
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "$cmd"
  fi
}

have_rsync() { command -v rsync >/dev/null 2>&1; }

transfer_file() {
  local local_path="$1"
  local remote_dir="$2"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] transfer $local_path -> ${REMOTE_USER}@${HOST}:${remote_dir}/"
    return 0
  fi

  if [[ "$TRANSFER" == "rsync" ]] && have_rsync; then
    rsync -avP --inplace -e "ssh ${SSH_OPTS[*]}" \
      "$local_path" "${REMOTE_USER}@${HOST}:${remote_dir}/"
  else
    # IMPORTANT: no quotes in scp destination path
    scp "${SSH_OPTS[@]}" -p "$local_path" "${REMOTE_USER}@${HOST}:${remote_dir}/"
  fi
}

retry() {
  local n=0
  local max="$1"
  shift
  until "$@"; do
    n=$((n+1))
    if [[ "$n" -ge "$max" ]]; then
      echo "ERROR: command failed after ${max} attempts: $*"
      return 1
    fi
    echo "WARN: command failed (attempt $n/${max}). Retrying in 3s..."
    sleep 3
  done
}

confirm_or_exit() {
  if [[ "$DRY_RUN" == "true" || "$ASSUME_YES" == "true" ]]; then
    return 0
  fi
  echo
  echo "Proceed with deployment? (y/N)"
  read -r ans
  case "$ans" in
    y|Y|yes|YES) return 0;;
    *) echo "Aborted."; exit 1;;
  esac
}

create_default_containerfile_if_missing() {
  local app_dir="$1"

  if [[ -f "${app_dir}/Containerfile" || -f "${app_dir}/Dockerfile" ]]; then
    return 0
  fi

  local cf="${app_dir}/Containerfile"
  echo "==> No Containerfile/Dockerfile found. Creating a default Containerfile at: $cf"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] create default Containerfile (UBI9 nodejs-20 base, EXPOSE 8080, CMD npm start)"
    return 0
  fi

  cat > "$cf" <<'EOF'
# Default Containerfile generated by deploy-oci.sh
FROM registry.access.redhat.com/ubi9/nodejs-20:latest
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
ENV NODE_ENV=production
EXPOSE 8080

CMD ["npm", "start"]
EOF

  echo "==> Created default Containerfile. Review CMD/EXPOSE if needed."
}

# -------------------------
# Plan
# -------------------------
IMAGE="local/${APP}:${TAG}"
STAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_NAME="${APP}_${TAG}_${STAMP}.image.tar"
LOCAL_ARCHIVE="/tmp/${ARCHIVE_NAME}"
LOCAL_SHA="${LOCAL_ARCHIVE}.sha256"

REMOTE_APP_DIR="${REMOTE_DIR}/${APP}"
REMOTE_ARCHIVE="${REMOTE_APP_DIR}/${ARCHIVE_NAME}"
REMOTE_SHA="${REMOTE_ARCHIVE}.sha256"

CONTAINER_NAME="$APP"
PORT_HOST="${PORT_MAP%%:*}"
PORT_CONT="${PORT_MAP##*:}"

echo "==> Deployment plan"
print_kv "Local app dir:" "$LOCAL_APP_DIR"
print_kv "Local engine:" "$ENGINE"
print_kv "Image tag:" "$IMAGE"
print_kv "Local archive:" "$LOCAL_ARCHIVE"
print_kv "Remote host:" "${REMOTE_USER}@${HOST}"
print_kv "Remote app dir:" "$REMOTE_APP_DIR"
print_kv "Port mapping:" "${PORT_HOST} -> ${PORT_CONT}"
print_kv "Restart policy:" "$RESTART_POLICY"
print_kv "Env file:" "${ENV_FILE:-<none>}"
print_kv "Systemd:" "$USE_SYSTEMD"
print_kv "Systemd scope:" "$SYSTEMD_SCOPE"
print_kv "Enable linger:" "$ENABLE_LINGER"
print_kv "Rollback:" "$DO_ROLLBACK"
print_kv "Keep archives:" "$KEEP_ARCHIVES"
print_kv "Keep images:" "$KEEP_IMAGES"
print_kv "Transfer:" "$TRANSFER (rsync avail: $(have_rsync && echo yes || echo no))"
print_kv "SSH keepalive:" "${SSH_KEEPALIVE}s x${SSH_KEEPALIVE_COUNT} (port ${SSH_PORT})"
print_kv "Retries:" "$RETRIES"
print_kv "Dry-run:" "$DRY_RUN"
echo

confirm_or_exit

# -------------------------
# Build + export
# -------------------------
echo "==> Preparing build context..."
create_default_containerfile_if_missing "$LOCAL_APP_DIR"

cd "$LOCAL_APP_DIR"

BUILD_FILE=""
if [[ -f "Containerfile" ]]; then
  BUILD_FILE="Containerfile"
elif [[ -f "Dockerfile" ]]; then
  BUILD_FILE="Dockerfile"
else
  echo "ERROR: Still no Containerfile/Dockerfile found (unexpected)."
  exit 1
fi

echo "==> Building image locally..."
run_local "$ENGINE" build -f "$BUILD_FILE" -t "$IMAGE" .

echo "==> Exporting image archive to $LOCAL_ARCHIVE"
run_local rm -f "$LOCAL_ARCHIVE" "$LOCAL_SHA"

if [[ "$ENGINE" == "podman" ]]; then
  run_local "$ENGINE" save --format oci-archive -o "$LOCAL_ARCHIVE" "$IMAGE"
else
  run_local "$ENGINE" save -o "$LOCAL_ARCHIVE" "$IMAGE"
fi

echo "==> Local integrity checks..."
run_local tar -tf "$LOCAL_ARCHIVE" >/dev/null
if [[ "$DRY_RUN" != "true" ]]; then
  sha256sum "$LOCAL_ARCHIVE" > "$LOCAL_SHA"
  echo "    sha256: $(cut -d' ' -f1 < "$LOCAL_SHA")"
else
  echo "    [dry-run] sha256sum $LOCAL_ARCHIVE > $LOCAL_SHA"
fi

# -------------------------
# Remote prep + transfer
# -------------------------
echo "==> Ensuring remote directory exists..."
ssh_run "test -d '$REMOTE_APP_DIR' || mkdir -p '$REMOTE_APP_DIR'"

echo "==> Transferring archive + checksum to remote..."
retry "$RETRIES" transfer_file "$LOCAL_ARCHIVE" "$REMOTE_APP_DIR"
retry "$RETRIES" transfer_file "$LOCAL_SHA" "$REMOTE_APP_DIR"

echo "==> Verifying checksum on remote..."
ssh_run "cd '$REMOTE_APP_DIR' && sha256sum -c '$(basename "$REMOTE_SHA")'"

echo "==> Verifying remote tar readability (catches truncated archives / unexpected EOF)..."
ssh_run "cd '$REMOTE_APP_DIR' && tar -tf '$(basename "$REMOTE_ARCHIVE")' >/dev/null"

# -------------------------
# Load + confirm image on remote
# -------------------------
REMOTE_ENGINE="podman"
echo "==> Loading image into remote podman..."
LOAD_OUT=""
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] ssh ${REMOTE_USER}@${HOST} cd '$REMOTE_APP_DIR' && ${REMOTE_ENGINE} load -i '$(basename "$REMOTE_ARCHIVE")'"
  LOAD_OUT="Loaded image(s): ${IMAGE}"
else
  LOAD_OUT="$(ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "cd '$REMOTE_APP_DIR' && ${REMOTE_ENGINE} load -i '$(basename "$REMOTE_ARCHIVE")'")"
  echo "$LOAD_OUT"
fi

LOADED_REF="$(echo "$LOAD_OUT" | sed -n 's/^Loaded image(s): //p' | head -n1 || true)"
if [[ -z "$LOADED_REF" ]]; then
  LOADED_REF="$IMAGE"
fi

echo "==> Confirming image exists on remote: $LOADED_REF"
ssh_run "${REMOTE_ENGINE} images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -F \"$LOADED_REF\""

# -------------------------
# Determine remote rootless + effective systemd scope
# -------------------------
REMOTE_ROOTLESS="unknown"
if [[ "$DRY_RUN" == "true" ]]; then
  REMOTE_ROOTLESS="true"
else
  REMOTE_ROOTLESS="$(ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "${REMOTE_ENGINE} info --format '{{.Host.Security.Rootless}}' 2>/dev/null || echo unknown")"
fi

EFFECTIVE_SCOPE="$SYSTEMD_SCOPE"
if [[ "$SYSTEMD_SCOPE" == "auto" ]]; then
  if [[ "$REMOTE_ROOTLESS" == "true" ]]; then
    EFFECTIVE_SCOPE="user"
  else
    EFFECTIVE_SCOPE="system"
  fi
fi

echo "==> Remote podman rootless: $REMOTE_ROOTLESS"
echo "==> Effective systemd scope: $EFFECTIVE_SCOPE"

# -------------------------
# Rollback: capture previous container image ID
# -------------------------
echo "==> Capturing previous container image (for rollback, if enabled)..."
OLD_IMAGE_ID=""
if [[ "$DRY_RUN" != "true" ]]; then
  OLD_IMAGE_ID="$(ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "${REMOTE_ENGINE} inspect -f '{{.Image}}' '$CONTAINER_NAME' 2>/dev/null || true")"
fi
if [[ -n "$OLD_IMAGE_ID" ]]; then
  echo "    previous image ID: $OLD_IMAGE_ID"
else
  echo "    no existing container found."
fi

# -------------------------
# (Re)run container
# -------------------------
echo "==> Stopping/removing existing container (if any): $CONTAINER_NAME"
ssh_run "${REMOTE_ENGINE} rm -f '$CONTAINER_NAME' >/dev/null 2>&1 || true"

RUN_CMD="${REMOTE_ENGINE} run -d --name '$CONTAINER_NAME' -p '${PORT_HOST}:${PORT_CONT}' --restart=${RESTART_POLICY}"
if [[ -n "$ENV_FILE" ]]; then
  RUN_CMD="${RUN_CMD} --env-file '$ENV_FILE'"
fi
RUN_CMD="${RUN_CMD} '$LOADED_REF'"

echo "==> Starting container..."
echo "    $RUN_CMD"
START_OK="true"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] ssh ${REMOTE_USER}@${HOST} $RUN_CMD"
else
  if ! ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "$RUN_CMD"; then
    START_OK="false"
  fi
fi

echo "==> Verifying container is running..."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] ssh ${REMOTE_USER}@${HOST} ${REMOTE_ENGINE} ps --filter name='^${CONTAINER_NAME}$'"
else
  if ! ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" \
    "${REMOTE_ENGINE} ps --filter name='^${CONTAINER_NAME}$' --format '{{.Names}} {{.Status}}'" \
    | grep -q "^${CONTAINER_NAME} "; then
    START_OK="false"
  fi
fi

if [[ "$START_OK" != "true" ]]; then
  echo "ERROR: New container did not start cleanly."
  if [[ "$DO_ROLLBACK" == "true" && -n "$OLD_IMAGE_ID" ]]; then
    echo "==> Attempting rollback to previous image ID: $OLD_IMAGE_ID"
    ssh_run "${REMOTE_ENGINE} rm -f '$CONTAINER_NAME' >/dev/null 2>&1 || true"

    RB_CMD="${REMOTE_ENGINE} run -d --name '$CONTAINER_NAME' -p '${PORT_HOST}:${PORT_CONT}' --restart=${RESTART_POLICY}"
    if [[ -n "$ENV_FILE" ]]; then
      RB_CMD="${RB_CMD} --env-file '$ENV_FILE'"
    fi
    RB_CMD="${RB_CMD} '$OLD_IMAGE_ID'"

    echo "    $RB_CMD"
    ssh_run "$RB_CMD"

    echo "==> Rollback container status:"
    ssh_run "${REMOTE_ENGINE} ps --filter name='^${CONTAINER_NAME}$' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'"

    echo "Rollback attempted. Check logs:"
    echo "  ssh ${REMOTE_USER}@${HOST} \"${REMOTE_ENGINE} logs --tail 200 ${CONTAINER_NAME}\""
    exit 1
  else
    echo "No rollback performed (either --rollback not set or no prior container image available)."
    echo "Check logs:"
    echo "  ssh ${REMOTE_USER}@${HOST} \"${REMOTE_ENGINE} logs --tail 200 ${CONTAINER_NAME}\""
    exit 1
  fi
fi

echo "==> Container status (brief):"
ssh_run "${REMOTE_ENGINE} ps --filter name='^${CONTAINER_NAME}$' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'"

# -------------------------
# systemd setup
# -------------------------
if [[ "$USE_SYSTEMD" == "true" ]]; then
  if [[ "$EFFECTIVE_SCOPE" == "user" ]]; then
    echo "==> Setting up USER systemd service (rootless-friendly)..."

    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] ssh ${REMOTE_USER}@${HOST} loginctl show-user '${REMOTE_USER}' -p Linger"
      if [[ "$ENABLE_LINGER" == "true" ]]; then
        echo "[dry-run] ssh ${REMOTE_USER}@${HOST} sudo loginctl enable-linger '${REMOTE_USER}'"
      fi
    else
      LINGER_LINE="$(ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "loginctl show-user '${REMOTE_USER}' -p Linger 2>/dev/null || true")"
      echo "    ${LINGER_LINE:-Linger=unknown}"
      if echo "$LINGER_LINE" | grep -q "Linger=no"; then
        if [[ "$ENABLE_LINGER" == "true" ]]; then
          echo "    Enabling linger for ${REMOTE_USER} (sudo)..."
          ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "sudo loginctl enable-linger '${REMOTE_USER}'"
          ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "loginctl show-user '${REMOTE_USER}' -p Linger"
        else
          echo "WARN: Linger is disabled. For boot-time start without login, run:"
          echo "      sudo loginctl enable-linger ${REMOTE_USER}"
        fi
      fi
    fi

    ssh_run "
      set -euo pipefail
      mkdir -p \"\$HOME/.config/systemd/user\"
      cd \"\$HOME/.config/systemd/user\"
      ${REMOTE_ENGINE} generate systemd --name '${CONTAINER_NAME}' --files --new >/dev/null
      systemctl --user daemon-reload
      systemctl --user enable --now \"container-${CONTAINER_NAME}.service\"
      systemctl --user --no-pager -l status \"container-${CONTAINER_NAME}.service\" | sed -n '1,14p'
    "
  else
    echo "==> Setting up SYSTEM systemd service (rootful)..."
    ssh_run "
      set -euo pipefail
      mkdir -p '${REMOTE_APP_DIR}/systemd'
      cd '${REMOTE_APP_DIR}/systemd'
      ${REMOTE_ENGINE} generate systemd --name '${CONTAINER_NAME}' --files --new >/dev/null
      UNIT_FILE=\$(ls -1 container-${CONTAINER_NAME}.service | head -n 1)
      echo \"Generated unit: \${UNIT_FILE}\"
      sudo mv \"\${UNIT_FILE}\" /etc/systemd/system/
      sudo systemctl daemon-reload
      sudo systemctl enable --now \"container-${CONTAINER_NAME}.service\"
      sudo systemctl --no-pager -l status \"container-${CONTAINER_NAME}.service\" | sed -n '1,14p'
    "
  fi
else
  echo "==> Skipping systemd setup (add --use-systemd to enable)."
fi

# -------------------------
# Pruning
# -------------------------
if [[ "$KEEP_ARCHIVES" != "0" ]]; then
  echo "==> Pruning remote archives (keep newest ${KEEP_ARCHIVES})..."
  ssh_run "
    set -euo pipefail
    cd '${REMOTE_APP_DIR}'
    ls -1t *.image.tar 2>/dev/null | tail -n +$((KEEP_ARCHIVES+1)) | xargs -r rm -f
    ls -1t *.image.tar.sha256 2>/dev/null | tail -n +$((KEEP_ARCHIVES+1)) | xargs -r rm -f
  "
else
  echo "==> Archive pruning disabled (--keep-archives 0)."
fi

if [[ "$KEEP_IMAGES" != "0" ]]; then
  echo "==> Pruning remote images (best-effort, keep newest ${KEEP_IMAGES} for repo local/${APP})..."
  ssh_run "
    set -euo pipefail
    CUR_ID=\$(${REMOTE_ENGINE} inspect -f '{{.Image}}' '${CONTAINER_NAME}' 2>/dev/null || true)
    OLD_ID='${OLD_IMAGE_ID}'
    ${REMOTE_ENGINE} images --format '{{.CreatedAt}} {{.Repository}}:{{.Tag}} {{.ID}}' | \
      awk '\$2 ~ /(^|\\/)local\\/${APP}:/ {print}' | \
      sort -r | \
      awk 'NR>${KEEP_IMAGES} {print \$3}' | \
      while read -r id; do
        [[ -n \"\$CUR_ID\" && \"\$id\" == \"\$CUR_ID\" ]] && continue
        [[ -n \"\$OLD_ID\" && \"\$id\" == \"\$OLD_ID\" ]] && continue
        if ! ${REMOTE_ENGINE} ps -a --format '{{.ImageID}}' | grep -q \"^\$id$\"; then
          ${REMOTE_ENGINE} rmi -f \"\$id\" >/dev/null 2>&1 || true
        fi
      done
  "
else
  echo "==> Image pruning disabled (--keep-images 0)."
fi

echo
echo "==> DONE"
echo "Remote app dir: ${REMOTE_APP_DIR}"
echo "Archive:        $(basename "$REMOTE_ARCHIVE")"
echo "Image ref:      ${LOADED_REF}"
echo "Container:      ${CONTAINER_NAME}"
echo "Port mapping:   ${PORT_HOST} -> ${PORT_CONT}"
echo "Remote rootless: ${REMOTE_ROOTLESS}"
echo "Systemd scope:   ${EFFECTIVE_SCOPE}"
if [[ -n "$ENV_FILE" ]]; then
  echo "Env file:       ${ENV_FILE}"
fi
if [[ "$DRY_RUN" == "true" ]]; then
  echo "NOTE: dry-run mode enabled; no changes were made."
fi
