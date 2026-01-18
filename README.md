# deploy-oci.sh

A **production-grade deployment script** for shipping Node.js applications as a **single OCI image archive**
from a development machine to **air‑gapped RHEL 9 servers** using **Podman**.

This README is split into **Developer** and **Operator** sections and includes a **deployment flow diagram**.

---

## Table of Contents

1. Overview  
2. Architecture & Flow Diagram  
3. Developer Guide  
4. Operator Guide  
5. Rootless vs Rootful Podman  
6. Rollback & Pruning  
7. Dry‑Run & Safety  
8. Troubleshooting  
9. Design Principles  

---

## 1. Overview

`deploy-oci.sh` automates the **entire lifecycle** of deploying a containerized Node.js app into an
**air‑gapped RHEL9 environment**:

- Local build
- Single‑file image export
- Reliable transfer
- Integrity verification
- Podman load
- Container restart
- Optional systemd management
- Optional rollback and pruning

The script is optimized for **rootless Podman** (recommended) but supports **rootful** deployments.

---

## 2. Architecture & Flow Diagram

```
┌────────────────────────────┐
│  Developer Laptop / WSL    │
│                            │
│  ~/projects/<app>          │
│   ├─ Containerfile         │
│   ├─ package.json          │
│   └─ server.js             │
│                            │
│  deploy-oci.sh             │
└─────────────┬──────────────┘
              │
              │ 1. podman/docker build
              ▼
┌────────────────────────────┐
│ Local OCI Image             │
│ local/<app>:latest          │
└─────────────┬──────────────┘
              │
              │ 2. podman save (single tar)
              ▼
┌────────────────────────────┐
│ /tmp/<app>_<ts>.image.tar  │
│ + sha256 checksum          │
└─────────────┬──────────────┘
              │
              │ 3. rsync/scp (with keepalive)
              ▼
┌────────────────────────────────────────┐
│ Air‑Gapped RHEL 9 Server                │
│                                        │
│ /home/<user>/node/<app>/               │
│   ├─ image.tar                         │
│   └─ image.tar.sha256                  │
│                                        │
│ 4. sha256sum -c                        │
│ 5. tar -tf (EOF detection)             │
│ 6. podman load                         │
│ 7. podman run                          │
│ 8. systemd (optional)                  │
└────────────────────────────────────────┘
```

---

## 3. Developer Guide

### 3.1 Requirements (Developer)

- Linux or WSL Ubuntu
- Podman **or** Docker
- Node.js project with:
  - `Containerfile` or `Dockerfile`
- Project layout:
  ```
  ~/projects/<app>/
  ```

### 3.2 Installing the Script

```bash
mkdir -p ~/bin
cp deploy-oci.sh ~/bin/deploy-oci.sh
chmod +x ~/bin/deploy-oci.sh
```

Ensure `~/bin` is in your PATH.

---

### 3.3 Basic Deployment Command

```bash
deploy-oci.sh   --app Team-Nexus   --host dblvlecdd0000a   --remote-user adm_tduncan28   --port 8080:8080
```

---

### 3.4 Production‑Grade Deployment

```bash
deploy-oci.sh   --app Team-Nexus   --host dblvlecdd0000a   --remote-user adm_tduncan28   --projects-dir /home/troy/projects   --port 8080:8080   --env-file /home/adm_tduncan28/node/Team-Nexus/Team-Nexus.env   --use-systemd   --systemd-scope auto   --enable-linger   --rollback   --keep-archives 7   --keep-images 5   --yes
```

---

### 3.5 Dry‑Run Mode

Preview all actions without making changes:

```bash
deploy-oci.sh   --app Team-Nexus   --host dblvlecdd0000a   --use-systemd   --dry-run
```

---

## 4. Operator Guide

### 4.1 Target Host Requirements

- RHEL 9.x
- Podman installed
- SSH access
- Rootless Podman **recommended**
- SELinux permissive or enforcing (script compatible)

### 4.2 Rootless Podman (Recommended)

Confirmed by:

```bash
podman info --format '{{.Host.Security.Rootless}}'
```

Benefits:
- No root container runtime
- User‑level systemd units
- Safer multi‑tenant operation

---

### 4.3 systemd Integration

#### User scope (rootless)

- Units stored in:
  ```
  ~/.config/systemd/user/
  ```
- Managed with:
  ```bash
  systemctl --user
  ```

#### Enable linger (required for boot startup)

```bash
sudo loginctl enable-linger <user>
```

The script can do this automatically using:

```bash
--enable-linger
```

---

### 4.4 Rootful Podman (Less Common)

- Units installed into:
  ```
  /etc/systemd/system/
  ```
- Requires sudo
- Enabled with:
  ```bash
  --systemd-scope system
  ```

---

## 5. Rollback & Pruning

### 5.1 Rollback

Enable rollback:

```bash
--rollback
```

If the new container fails:
- Script recreates the container using the **previous image ID**
- Preserves ports and env files

---

### 5.2 Pruning

Keep latest archives:

```bash
--keep-archives 5
```

Prune old unused images:

```bash
--keep-images 3
```

Disable pruning:

```bash
--keep-archives 0 --keep-images 0
```

---

## 6. Safety & Integrity

Before loading an image on the server:

- `sha256sum -c`
- `tar -tf` (detects truncated archives / EOF)

This prevents corrupted air‑gap transfers from reaching production.

---

## 7. Troubleshooting

### Container not running
```bash
podman logs <app> --tail 200
```

### systemd user service not starting at boot
```bash
loginctl show-user <user> -p Linger
```

### Port binding failure
- Rootless Podman cannot bind ports <1024
- Use 8080/8443 or a reverse proxy

---

## 8. Exit Codes

| Code | Meaning |
|----|--------|
| 0 | Success |
| 1 | Failure or rollback triggered |

---

## 9. Design Principles

- Fail fast
- Verify everything
- Trust nothing over the network
- Rootless by default
- Rollback must be cheap

---

**Author:** Troy Duncan  
**Target Environment:** WSL → Air‑Gapped RHEL 9 (Podman rootless)


### Mermaid Diagram (GitHub/GitLab)

```mermaid
flowchart TD
  A[Developer Laptop / WSL<br/>~/projects/&lt;app&gt;] -->|1. Build image<br/>podman/docker build| B[Local Image<br/>local/&lt;app&gt;:&lt;tag&gt;]
  B -->|2. Export single archive<br/>podman save --format oci-archive<br/>or docker save| C[/tmp/&lt;app&gt;_&lt;tag&gt;_&lt;ts&gt;.image.tar<br/>+ .sha256]
  C -->|3. Transfer (resumable)<br/>rsync -avP --inplace<br/>or scp fallback<br/>SSH keepalives + retries| D[Air-gapped RHEL9 Host<br/>/home/&lt;user&gt;/node/&lt;app&gt;/]
  D -->|4. Verify checksum<br/>sha256sum -c| E{Checksum OK?}
  E -->|No| X[Fail deploy<br/>Re-transfer archive]
  E -->|Yes| F[5. Verify tar readable<br/>tar -tf (EOF detection)]
  F -->|6. podman load -i| G[Remote Image Store<br/>(rootless: ~/.local/share/containers)]
  G -->|7. Stop old container<br/>podman rm -f &lt;app&gt;| H[Run new container<br/>podman run -d ...]
  H -->|8. Verify running<br/>podman ps| I{Running?}
  I -->|No + rollback enabled| J[Rollback<br/>re-run with previous image ID]
  I -->|Yes| K{--use-systemd?}
  K -->|No| Z[Done]
  K -->|Yes| L{Scope auto/user/system}
  L -->|user (rootless)| M[Install user unit<br/>~/.config/systemd/user/<br/>systemctl --user enable --now]
  L -->|system (rootful)| N[Install system unit<br/>/etc/systemd/system/<br/>sudo systemctl enable --now]
  M --> O[Prune archives/images<br/>(optional)]
  N --> O
  O --> Z[Done]
```

