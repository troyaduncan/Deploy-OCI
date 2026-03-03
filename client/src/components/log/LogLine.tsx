import { cn } from "../../lib/utils.ts";

interface LogLineProps {
  line: string;
  stream: "stdout" | "stderr";
  timestamp: string;
  index?: number;
}

function getLineClass(line: string, stream: "stdout" | "stderr"): string {
  if (stream === "stderr") return "text-red-400";
  if (line.startsWith("==> DONE")) return "text-status-success font-semibold";
  if (line.startsWith("==>")) return "text-magenta font-semibold";
  if (line.startsWith("[dry-run]")) return "text-amber-400";
  if (line.includes("ERROR:")) return "text-red-400 font-semibold";
  if (line.includes("WARN:")) return "text-amber-400";
  if (line.startsWith("    sha256:")) return "text-emerald-400 font-mono";
  if (line.startsWith("    ")) return "text-surface-200";
  return "text-gray-300";
}

export function LogLine({ line, stream, timestamp, index }: LogLineProps) {
  const time = new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const lineClass = getLineClass(line, stream);

  return (
    <div
      className={cn(
        "flex gap-3 leading-relaxed px-2 py-0.5 rounded hover:bg-surface-800/50",
        index !== undefined && index % 2 === 0 ? "" : ""
      )}
    >
      <span className="text-surface-400 text-xs pt-0.5 w-[58px] flex-shrink-0 select-none font-mono">
        {time}
      </span>
      <span className={cn("min-w-0 break-all font-mono text-xs", lineClass)}>
        {line || "\u00A0"}
      </span>
    </div>
  );
}
