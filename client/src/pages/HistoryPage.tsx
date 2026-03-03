import { HistoryTable } from "../components/history/HistoryTable.tsx";

export function HistoryPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-surface-600 flex-shrink-0">
        <h1 className="text-base font-semibold text-white">
          Deployment History
        </h1>
        <p className="text-xs text-surface-400 mt-0.5">
          Click any row to view the full deployment log
        </p>
      </div>

      {/* Table fills remaining height */}
      <div className="flex-1 overflow-hidden min-h-0">
        <HistoryTable />
      </div>
    </div>
  );
}
