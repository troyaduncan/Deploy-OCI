import type { PipelineStepName, SseStepEvent } from "@deploy-oci/shared";

// Maps deploy-oci.sh "==>" log line patterns to pipeline step transitions.
// Patterns are derived from the exact echo statements in deploy-oci.sh.
const STEP_PATTERNS: Array<[RegExp, PipelineStepName, boolean]> = [
  // [pattern, stepName, isDone (true = mark step done, false = mark running)]
  [/^==> Building image locally/, "local-build", false],
  [/^==> Exporting image archive/, "local-export", false],
  [/^==> Transferring archive/, "transfer", false],
  [/^==> Verifying checksum on remote/, "remote-verify", false],
  [/^==> Loading image into remote podman/, "remote-load", false],
  [/^==> Remote podman rootless:/, "rootless-detect", false],
  [/^==> Starting container/, "container-restart", false],
  [/^==> Setting up (USER|SYSTEM) systemd service/, "systemd-integration", false],
  [/^==> Skipping systemd setup/, "systemd-integration", true], // mark done+skipped
  [/^==> Pruning remote (archives|images)/, "pruning", false],
  [/^==> Archive pruning disabled/, "pruning", true],
];

// Tracks which steps have been seen so we can auto-complete previous step
const STEP_ORDER: PipelineStepName[] = [
  "local-build",
  "local-export",
  "transfer",
  "remote-verify",
  "remote-load",
  "rootless-detect",
  "container-restart",
  "systemd-integration",
  "pruning",
];

export function parseStepFromLine(
  line: string,
  lastStep: PipelineStepName | null
): SseStepEvent[] {
  for (const [pattern, step, isDone] of STEP_PATTERNS) {
    if (pattern.test(line)) {
      const events: SseStepEvent[] = [];

      // Mark the previous running step as done
      if (lastStep && lastStep !== step) {
        events.push({ type: "step", step: lastStep, status: "done" });
      }

      if (isDone) {
        // Mark this step as skipped immediately
        events.push({ type: "step", step, status: "skipped" });
      } else {
        events.push({ type: "step", step, status: "running" });
      }

      return events;
    }
  }
  return [];
}

export { STEP_ORDER };
