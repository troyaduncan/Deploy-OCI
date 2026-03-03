import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { DeployFormValues } from "./DeployForm.tsx";
import {
  ChevronDown,
  ChevronRight,
  Settings,
} from "lucide-react";
import { cn } from "../../lib/utils.ts";

interface Props {
  form: UseFormReturn<DeployFormValues>;
}

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={cn(
            "w-9 h-5 rounded-full transition-colors",
            checked ? "bg-magenta" : "bg-surface-600"
          )}
        />
        <div
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
      <div>
        <p className="text-sm text-white group-hover:text-white leading-tight">
          {label}
        </p>
        {description && (
          <p className="text-xs text-surface-400 mt-0.5 leading-snug">
            {description}
          </p>
        )}
      </div>
    </label>
  );
}

export function AdvancedSection({ form }: Props) {
  const [open, setOpen] = useState(false);
  const { register, watch, setValue } = form;
  const useSystemd = watch("useSystemd");
  const enableLinger = watch("enableLinger");
  const rollback = watch("rollback");

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="section-header"
      >
        <span className="flex items-center gap-2">
          <Settings size={14} />
          Advanced
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-surface-600">
          {/* Systemd */}
          <div className="pt-3 space-y-3">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Systemd
            </p>
            <Toggle
              checked={useSystemd}
              onChange={(v) => setValue("useSystemd", v)}
              label="Enable Systemd Service"
              description="Install container as a systemd unit on the remote host"
            />

            {useSystemd && (
              <>
                <div>
                  <label className="label-base">Systemd Scope</label>
                  <select {...register("systemdScope")} className="input-base">
                    <option value="auto">auto (detect rootless)</option>
                    <option value="user">user (rootless)</option>
                    <option value="system">system (rootful)</option>
                  </select>
                </div>

                <Toggle
                  checked={enableLinger}
                  onChange={(v) => setValue("enableLinger", v)}
                  label="Enable Linger"
                  description="Allow user systemd services to start at boot without login"
                />
              </>
            )}
          </div>

          {/* Rollback */}
          <div className="border-t border-surface-600 pt-4 space-y-2">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Safety
            </p>
            <Toggle
              checked={rollback}
              onChange={(v) => setValue("rollback", v)}
              label="Enable Rollback"
              description="Auto-rollback to previous container image if new container fails to start"
            />
          </div>

          {/* Pruning */}
          <div className="border-t border-surface-600 pt-4 space-y-3">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Pruning
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">
                  Keep Archives{" "}
                  <span className="text-surface-400">(0=off)</span>
                </label>
                <input
                  {...register("keepArchives")}
                  type="number"
                  min={0}
                  className="input-base"
                  placeholder="5"
                />
              </div>
              <div>
                <label className="label-base">
                  Keep Images{" "}
                  <span className="text-surface-400">(0=off)</span>
                </label>
                <input
                  {...register("keepImages")}
                  type="number"
                  min={0}
                  className="input-base"
                  placeholder="3"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
