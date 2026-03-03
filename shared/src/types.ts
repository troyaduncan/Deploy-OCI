// Mirrors all 25+ deploy-oci.sh options as a TypeScript interface
export interface DeploymentConfig {
  // Required
  app: string;
  host: string;

  // Connection
  remoteUser: string;
  sshPort: number;
  sshKeepalive: number;
  sshKeepaliveCount: number;

  // Paths
  projectsDir: string;
  remoteDir: string;

  // Container
  port: string;
  envFile: string;
  engine: "podman" | "docker";
  tag: string;
  restartPolicy: string;

  // Systemd
  useSystemd: boolean;
  systemdScope: "auto" | "user" | "system";
  enableLinger: boolean;

  // Safety
  rollback: boolean;
  dryRun: boolean;

  // Transfer
  transfer: "rsync" | "scp";
  retries: number;

  // Pruning
  keepArchives: number;
  keepImages: number;
}

export type DeploymentStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export type PipelineStepName =
  | "local-build"
  | "local-export"
  | "transfer"
  | "remote-verify"
  | "remote-load"
  | "rootless-detect"
  | "container-restart"
  | "systemd-integration"
  | "pruning";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface PipelineStep {
  name: PipelineStepName;
  label: string;
  status: StepStatus;
}

export interface DeploymentRecord {
  id: string;
  app: string;
  host: string;
  status: DeploymentStatus;
  config: DeploymentConfig;
  log: string;
  startedAt: string;
  completedAt: string | null;
  exitCode: number | null;
}

// SSE event shapes
export interface SseLogEvent {
  type: "log";
  line: string;
  stream: "stdout" | "stderr";
  timestamp: string;
}

export interface SseStepEvent {
  type: "step";
  step: PipelineStepName;
  status: StepStatus;
}

export interface SseCompleteEvent {
  type: "complete";
  status: "success" | "failed";
  exitCode: number;
}

export interface SseErrorEvent {
  type: "error";
  message: string;
}

export type SseEvent =
  | SseLogEvent
  | SseStepEvent
  | SseCompleteEvent
  | SseErrorEvent;
