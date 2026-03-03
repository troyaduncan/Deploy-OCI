import { useEffect, useState, useCallback } from "react";
import { Eye, Trash2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { DeploymentRecord } from "@deploy-oci/shared";
import { api } from "../../lib/api.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { LogModal } from "./LogModal.tsx";
import { formatDuration, formatRelativeTime } from "../../lib/utils.ts";

export function HistoryTable() {
  const [records, setRecords] = useState<DeploymentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<DeploymentRecord | null>(null);
  const limit = 15;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getDeployments({ page, limit });
      setRecords(result.records);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to fetch deployments:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Auto-refresh while any deployment is running
  useEffect(() => {
    const hasRunning = records.some((r) => r.status === "running");
    if (!hasRunning) return;
    const interval = setInterval(fetchRecords, 3000);
    return () => clearInterval(interval);
  }, [records, fetchRecords]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this deployment record?")) return;
    try {
      await api.cancelDeployment(id);
      fetchRecords();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Table header actions */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div>
            <h2 className="text-base font-semibold text-white">
              Deployment History
            </h2>
            <p className="text-xs text-surface-400 mt-0.5">
              {total} total deployment{total !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="btn-ghost flex items-center gap-1.5"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-900 z-10">
              <tr className="border-b border-surface-600">
                <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  App
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  Host
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  Started
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  Tags
                </th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {loading && records.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-16 text-surface-400 text-sm"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && records.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-16 text-surface-400 text-sm"
                  >
                    No deployments yet. Launch one from the Deploy tab.
                  </td>
                </tr>
              )}
              {records.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="border-b border-surface-600/50 hover:bg-surface-800 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="font-mono font-medium text-white text-sm">
                      {record.app}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-surface-200 text-xs">
                      {record.host}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="py-3 px-4 text-surface-400 text-xs whitespace-nowrap">
                    {formatRelativeTime(record.startedAt)}
                  </td>
                  <td className="py-3 px-4 text-surface-400 text-xs font-mono whitespace-nowrap">
                    {formatDuration(record.startedAt, record.completedAt)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {record.config.dryRun && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          dry-run
                        </span>
                      )}
                      {record.config.useSystemd && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                          systemd
                        </span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-700 text-surface-400 font-mono">
                        {record.config.engine}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(record);
                        }}
                        className="p-1.5 rounded text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
                        title="View logs"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(record.id, e)}
                        className="p-1.5 rounded text-surface-400 hover:text-red-400 hover:bg-surface-700 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-surface-600">
            <span className="text-xs text-surface-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost p-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost p-1.5 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log modal */}
      {selectedRecord && (
        <LogModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          isLive={selectedRecord.status === "running"}
        />
      )}
    </>
  );
}
