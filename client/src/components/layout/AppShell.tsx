import { Sidebar } from "./Sidebar.tsx";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
