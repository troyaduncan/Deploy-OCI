import { useEffect, useRef, useState } from "react";
import { X, Terminal } from "lucide-react";
import type { DeploymentRecord, SseEvent } from "@deploy-oci/shared";
import { LogLine } from "../log/LogLine.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { formatDuration, formatRelativeTime } from "../../lib/utils.ts";

interface LogEntry {
  line: string;
  stream: "stdout" | "stderr";
  timestamp: string;
}

function parseLogEntries(log: string): LogEntry[] {
  if (!log) return [];
  const entries: LogEntry[] = [];
  for (const raw of log.split("\n")) {
    if (!raw.trim()) continue;
    try {
      const parsed = JSON.parse(raw) as LogEntry;
      entries.push(parsed);
    } catch {
      // fallback for plain text logs
      entries.push({
        line: raw,
        stream: "stdout",
        timestamp: new Date().toISOString(),
      });
    }
  }
  return entries;
}

interface Props {
  record: DeploymentRecord;
  onClose: () => void;
  isLive?: boolean;
}

export function LogModal({ record, onClose, isLive = false }: Props) {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLive) {
      setLines(parseLogEntries(record.log));
      return;
    }

    // For live/running deployments, stream via SSE
    const es = new EventSource(`/api/deployments/${record.id}/stream`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as SseEvent;
      if (event.type === "log") {
        setLines((prev) => [
          ...prev,
          {
            line: event.line,
            stream: event.stream,
            timestamp: event.timestamp,
          },
        ]);
      }
      if (event.type === "complete") {
        es.close();
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [record.id, record.log, isLive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [lines.length]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-900 border border-surface-600 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Terminal size={16} className="text-magenta flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white font-mono">
                  {record.app}
                </span>
                <span className="text-surface-400 text-xs">→</span>
                <span className="text-sm text-surface-200 font-mono">
                  {record.host}
                </span>
                <StatusBadge status={record.status} />
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-surface-400">
                  {formatRelativeTime(record.startedAt)}
                </span>
                <span className="text-xs text-surface-400">
                  Duration:{" "}
                  {formatDuration(record.startedAt, record.completedAt)}
                </span>
                <span className="text-xs text-surface-400 font-mono">
                  {lines.length} lines
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Log body */}
        <div className="flex-1 overflow-y-auto bg-surface-950 py-2">
          {lines.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-surface-400 text-sm">No log output available.</p>
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
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
