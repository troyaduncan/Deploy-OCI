import type { DeploymentStatus } from "@deploy-oci/shared";
import { cn } from "../../lib/utils.ts";

const STATUS_STYLES: Record<DeploymentStatus, string> = {
  pending: "bg-status-pending/20 text-surface-200 border-surface-600",
  running: "bg-status-running/20 text-blue-300 border-blue-500/30 animate-pulse",
  success: "bg-status-success/20 text-emerald-300 border-emerald-500/30",
  failed: "bg-status-failed/20 text-red-300 border-red-500/30",
  cancelled: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const STATUS_LABELS: Record<DeploymentStatus, string> = {
  pending: "Pending",
  running: "Running",
  success: "Success",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
