import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DeployForm } from "../components/deploy/DeployForm.tsx";
import { PipelineProgress } from "../components/pipeline/PipelineProgress.tsx";
import { DeploymentLog } from "../components/log/DeploymentLog.tsx";
import type { DeploymentConfig, PipelineStep, SseEvent } from "@deploy-oci/shared";
import { api } from "../lib/api.ts";
import { ExternalLink } from "lucide-react";
import { cn } from "../lib/utils.ts";

const INITIAL_STEPS: PipelineStep[] = [
  { name: "local-build", label: "Build", status: "pending" },
  { name: "local-export", label: "Export", status: "pending" },
  { name: "transfer", label: "Transfer", status: "pending" },
  { name: "remote-verify", label: "Verify", status: "pending" },
  { name: "remote-load", label: "Load", status: "pending" },
  { name: "rootless-detect", label: "Rootless", status: "pending" },
  { name: "container-restart", label: "Restart", status: "pending" },
  { name: "systemd-integration", label: "Systemd", status: "pending" },
  { name: "pruning", label: "Pruning", status: "pending" },
];

type DeployStatus = "idle" | "running" | "success" | "failed";

interface LogEntry {
  line: string;
  stream: "stdout" | "stderr";
  timestamp: string;
}

export function DeployPage() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [logLines, setLogLines] = useState<LogEntry[]>([]);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [currentDeployId, setCurrentDeployId] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" as const })));
    setLogLines([]);
    setDeployStatus("idle");
    setCurrentDeployId(null);
  }, []);

  const handleDeploy = useCallback(async (config: DeploymentConfig) => {
    resetState();
    setDeployStatus("running");

    let id: string;
    try {
      const result = await api.startDeployment(config);
      id = result.id;
      setCurrentDeployId(id);
    } catch (err) {
      setDeployStatus("failed");
      setLogLines([
        {
          line: `ERROR: Failed to start deployment: ${err instanceof Error ? err.message : String(err)}`,
          stream: "stderr",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    const eventSource = new EventSource(`/api/deployments/${id}/stream`);

    eventSource.onmessage = (e) => {
      let event: SseEvent;
      try {
        event = JSON.parse(e.data) as SseEvent;
      } catch {
        return;
      }

      if (event.type === "log") {
        setLogLines((prev) => [
          ...prev,
          {
            line: event.line,
            stream: event.stream,
            timestamp: event.timestamp,
          },
        ]);
      } else if (event.type === "step") {
        setSteps((prev) =>
          prev.map((s) =>
            s.name === event.step ? { ...s, status: event.status } : s
          )
        );
      } else if (event.type === "complete") {
        setDeployStatus(event.status);
        eventSource.close();
      } else if (event.type === "error") {
        setDeployStatus("failed");
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setDeployStatus("failed");
      eventSource.close();
    };
  }, [resetState]);

  const handleCancel = async () => {
    if (!currentDeployId) return;
    try {
      await api.cancelDeployment(currentDeployId);
      setDeployStatus("failed");
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">New Deployment</h1>
          <p className="text-xs text-surface-400 mt-0.5">
            Deploy a containerized app to a remote RHEL 9 host
          </p>
        </div>
        <div className="flex items-center gap-2">
          {deployStatus === "running" && (
            <button
              onClick={handleCancel}
              className="text-xs px-3 py-1.5 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Cancel
            </button>
          )}
          {(deployStatus === "success" || deployStatus === "failed") && (
            <>
              <button onClick={resetState} className="btn-ghost text-xs">
                Reset
              </button>
              <button
                onClick={() => navigate("/history")}
                className="btn-ghost text-xs flex items-center gap-1"
              >
                <ExternalLink size={12} />
                View History
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left panel: Form */}
        <div
          className={cn(
            "w-80 flex-shrink-0 border-r border-surface-600 overflow-y-auto p-4",
            deployStatus === "running" && "pointer-events-none opacity-60"
          )}
        >
          <DeployForm onSubmit={handleDeploy} isDeploying={deployStatus === "running"} />
        </div>

        {/* Right panel: Pipeline + Log */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Pipeline progress */}
          <div className="px-6 py-4 border-b border-surface-600 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                Pipeline
              </span>
              {deployStatus !== "idle" && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    deployStatus === "running" && "text-magenta",
                    deployStatus === "success" && "text-status-success",
                    deployStatus === "failed" && "text-status-failed"
                  )}
                >
                  {deployStatus === "running"
                    ? "Deploying..."
                    : deployStatus === "success"
                    ? "Completed"
                    : "Failed"}
                </span>
              )}
            </div>
            <PipelineProgress steps={steps} />
          </div>

          {/* Log output */}
          <div className="flex-1 overflow-hidden min-h-0">
            <DeploymentLog lines={logLines} status={deployStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}
