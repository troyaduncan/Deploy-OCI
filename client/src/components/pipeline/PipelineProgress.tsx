import {
  Check,
  X,
  Loader2,
  Clock,
  SkipForward,
  Hammer,
  Archive,
  Upload,
  ShieldCheck,
  Download,
  Search,
  RefreshCw,
  Cpu,
  Scissors,
} from "lucide-react";
import type { PipelineStep, StepStatus } from "@deploy-oci/shared";
import { cn } from "../../lib/utils.ts";

const STEP_ICONS: Record<string, typeof Check> = {
  "local-build": Hammer,
  "local-export": Archive,
  "transfer": Upload,
  "remote-verify": ShieldCheck,
  "remote-load": Download,
  "rootless-detect": Search,
  "container-restart": RefreshCw,
  "systemd-integration": Cpu,
  "pruning": Scissors,
};

const STATUS_CONFIG: Record<
  StepStatus,
  { ring: string; bg: string; text: string; animate?: string }
> = {
  pending: {
    ring: "ring-surface-600",
    bg: "bg-surface-700",
    text: "text-surface-400",
  },
  running: {
    ring: "ring-magenta",
    bg: "bg-magenta",
    text: "text-white",
    animate: "animate-pulse",
  },
  done: {
    ring: "ring-status-success",
    bg: "bg-status-success",
    text: "text-white",
  },
  failed: {
    ring: "ring-status-failed",
    bg: "bg-status-failed",
    text: "text-white",
  },
  skipped: {
    ring: "ring-surface-600",
    bg: "bg-surface-700",
    text: "text-surface-400",
  },
};

function StepNode({ step }: { step: PipelineStep }) {
  const cfg = STATUS_CONFIG[step.status];
  const Icon = STEP_ICONS[step.name] ?? Clock;

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center ring-1 transition-all duration-300",
          cfg.ring,
          cfg.bg,
          cfg.animate
        )}
        title={step.label}
      >
        {step.status === "running" ? (
          <Loader2 size={14} className={cn(cfg.text, "animate-spin")} />
        ) : step.status === "done" ? (
          <Check size={14} className={cfg.text} />
        ) : step.status === "failed" ? (
          <X size={14} className={cfg.text} />
        ) : step.status === "skipped" ? (
          <SkipForward size={12} className={cfg.text} />
        ) : (
          <Icon size={13} className={cfg.text} />
        )}
      </div>
      <span
        className={cn(
          "text-[10px] font-mono text-center leading-tight max-w-[56px] truncate",
          step.status === "done"
            ? "text-status-success"
            : step.status === "running"
            ? "text-magenta font-semibold"
            : step.status === "failed"
            ? "text-status-failed"
            : "text-surface-400"
        )}
        title={step.label}
      >
        {step.label}
      </span>
    </div>
  );
}

export function PipelineProgress({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex items-start justify-between gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => (
        <div key={step.name} className="flex items-center gap-1 flex-shrink-0">
          <StepNode step={step} />
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-6 flex-shrink-0 mb-5 transition-colors duration-500",
                step.status === "done"
                  ? "bg-status-success"
                  : step.status === "running"
                  ? "bg-magenta/50"
                  : "bg-surface-600"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
