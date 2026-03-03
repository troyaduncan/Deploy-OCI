import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { DeployFormValues } from "./DeployForm.tsx";
import { ChevronDown, ChevronRight, Wifi } from "lucide-react";

interface Props {
  form: UseFormReturn<DeployFormValues>;
}

export function ConnectionSection({ form }: Props) {
  const [open, setOpen] = useState(false);
  const { register } = form;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="section-header"
      >
        <span className="flex items-center gap-2">
          <Wifi size={14} />
          Connection &amp; Paths
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-surface-600">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div>
              <label className="label-base">Remote User</label>
              <input
                {...register("remoteUser")}
                className="input-base"
                placeholder="adm_tduncan28"
              />
            </div>
            <div>
              <label className="label-base">SSH Port</label>
              <input
                {...register("sshPort")}
                type="number"
                className="input-base"
                placeholder="22"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Keepalive (sec)</label>
              <input
                {...register("sshKeepalive")}
                type="number"
                className="input-base"
                placeholder="20"
              />
            </div>
            <div>
              <label className="label-base">Keepalive Count</label>
              <input
                {...register("sshKeepaliveCount")}
                type="number"
                className="input-base"
                placeholder="6"
              />
            </div>
          </div>

          <div>
            <label className="label-base">Local Projects Dir</label>
            <input
              {...register("projectsDir")}
              className="input-base font-mono text-xs"
              placeholder="~/projects"
            />
          </div>

          <div>
            <label className="label-base">
              Remote Dir{" "}
              <span className="text-surface-400">(default: /home/user/node)</span>
            </label>
            <input
              {...register("remoteDir")}
              className="input-base font-mono text-xs"
              placeholder="/home/adm_tduncan28/node"
            />
          </div>
        </div>
      )}
    </div>
  );
}
