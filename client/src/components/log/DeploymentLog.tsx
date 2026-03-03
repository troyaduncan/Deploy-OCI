import { useEffect, useRef } from "react";
import { LogLine } from "./LogLine.tsx";
import { Terminal } from "lucide-react";
import { cn } from "../../lib/utils.ts";

interface LogEntry {
  line: string;
  stream: "stdout" | "stderr";
  timestamp: string;
}

interface DeploymentLogProps {
  lines: LogEntry[];
  status: "idle" | "running" | "success" | "failed";
}

export function DeploymentLog({ lines, status }: DeploymentLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-scroll when new lines arrive, but only if user hasn't scrolled up
  useEffect(() => {
    if (autoScrollRef.current && status === "running") {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [lines.length, status]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  // Re-enable auto-scroll on complete
  useEffect(() => {
    if (status === "success" || status === "failed") {
      autoScrollRef.current = true;
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [status]);

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Log header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-600 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-surface-400" />
          <span className="text-xs font-medium text-surface-400">
            Deployment Output
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === "running" && (
            <span className="flex items-center gap-1.5 text-xs text-magenta">
              <span className="w-1.5 h-1.5 bg-magenta rounded-full animate-pulse" />
              Live
            </span>
          )}
          {status === "success" && (
            <span className="text-xs text-status-success font-medium">
              ✓ Success
            </span>
          )}
          {status === "failed" && (
            <span className="text-xs text-status-failed font-medium">
              ✗ Failed
            </span>
          )}
          <span className="text-xs text-surface-400 font-mono">
            {lines.length} lines
          </span>
        </div>
      </div>

      {/* Log body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2"
      >
        {lines.length === 0 && status === "idle" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-400">
            <Terminal size={32} className="opacity-30" />
            <p className="text-sm">
              Configure and launch a deployment to see live output here.
            </p>
          </div>
        )}

        {lines.map((entry, i) => (
          <LogLine
            key={i}
            line={entry.line}
            stream={entry.stream}
            timestamp={entry.timestamp}
            index={i}
          />
        ))}

        {/* Status footer */}
        {lines.length > 0 && status !== "running" && status !== "idle" && (
          <div
            className={cn(
              "mx-4 mt-3 mb-2 py-2 px-3 rounded-md text-xs font-medium border",
              status === "success"
                ? "bg-status-success/10 border-status-success/30 text-status-success"
                : "bg-status-failed/10 border-status-failed/30 text-status-failed"
            )}
          >
            {status === "success"
              ? "✓ Deployment completed successfully"
              : "✗ Deployment failed — see output above for details"}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
