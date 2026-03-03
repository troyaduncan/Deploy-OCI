import type { DeploymentConfig } from "@deploy-oci/shared";

// Converts DeploymentConfig into CLI args array for deploy-oci.sh
export function buildScriptArgs(config: DeploymentConfig): string[] {
  const args: string[] = [];

  const push = (flag: string, value: string | number) =>
    args.push(flag, String(value));

  push("--app", config.app);
  push("--host", config.host);
  push("--remote-user", config.remoteUser);
  push("--ssh-port", config.sshPort);
  push("--ssh-keepalive", config.sshKeepalive);
  push("--ssh-keepalive-count", config.sshKeepaliveCount);
  push("--projects-dir", config.projectsDir);

  if (config.remoteDir) push("--remote-dir", config.remoteDir);
  if (config.port) push("--port", config.port);
  if (config.envFile) push("--env-file", config.envFile);

  push("--engine", config.engine);
  push("--tag", config.tag);
  push("--restart-policy", config.restartPolicy);
  push("--transfer", config.transfer);
  push("--retries", config.retries);
  push("--keep-archives", config.keepArchives);
  push("--keep-images", config.keepImages);

  if (config.useSystemd) args.push("--use-systemd");
  if (config.enableLinger) args.push("--enable-linger");
  if (config.rollback) args.push("--rollback");
  if (config.dryRun) args.push("--dry-run");

  push("--systemd-scope", config.systemdScope);

  // Web UI always assumes yes — no interactive prompts
  args.push("--yes");

  return args;
}
