import { NavLink } from "react-router-dom";
import { Rocket, History, Terminal } from "lucide-react";
import { cn } from "../../lib/utils.ts";

const navItems = [
  { to: "/deploy", label: "Deploy", icon: Rocket },
  { to: "/history", label: "History", icon: History },
];

export function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 bg-surface-950 border-r border-surface-600 flex flex-col">
      {/* T-Mobile branding */}
      <div className="p-4 border-b border-surface-600">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-magenta rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-magenta/20">
            <Terminal size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">
              Deploy OCI
            </p>
            <p className="text-surface-400 text-xs leading-tight mt-0.5">
              Container Deployment
            </p>
          </div>
        </div>
      </div>

      {/* T-Mobile wordmark accent */}
      <div className="px-4 py-2 border-b border-surface-600">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-magenta" />
          <span className="text-xs text-surface-400 font-medium tracking-wide uppercase">
            T&#8209;Mobile Internal
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-magenta text-white shadow-sm shadow-magenta/30"
                  : "text-surface-200 hover:bg-surface-800 hover:text-white"
              )
            }
          >
            <Icon size={16} className="flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-600">
        <p className="text-surface-400 text-xs leading-relaxed">
          Wraps{" "}
          <span className="font-mono text-surface-200">deploy-oci.sh</span>
        </p>
        <p className="text-surface-400 text-xs mt-1">
          RHEL 9 + Podman deploy
        </p>
      </div>
    </aside>
  );
}
