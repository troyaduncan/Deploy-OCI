import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { DeployFormValues } from "./DeployForm.tsx";
import { ChevronDown, ChevronRight, Box } from "lucide-react";

interface Props {
  form: UseFormReturn<DeployFormValues>;
}

export function ContainerSection({ form }: Props) {
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
          <Box size={14} />
          Container
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-surface-600">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div>
              <label className="label-base">Engine</label>
              <select {...register("engine")} className="input-base">
                <option value="podman">podman</option>
                <option value="docker">docker</option>
              </select>
            </div>
            <div>
              <label className="label-base">Image Tag</label>
              <input
                {...register("tag")}
                className="input-base"
                placeholder="latest"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Port Mapping</label>
              <input
                {...register("port")}
                className="input-base font-mono text-xs"
                placeholder="8080:8080"
              />
            </div>
            <div>
              <label className="label-base">Restart Policy</label>
              <select {...register("restartPolicy")} className="input-base">
                <option value="always">always</option>
                <option value="unless-stopped">unless-stopped</option>
                <option value="on-failure">on-failure</option>
                <option value="no">no</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label-base">
              Env File{" "}
              <span className="text-surface-400">(remote path, optional)</span>
            </label>
            <input
              {...register("envFile")}
              className="input-base font-mono text-xs"
              placeholder="/home/adm_tduncan28/node/App/App.env"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Transfer Method</label>
              <select {...register("transfer")} className="input-base">
                <option value="rsync">rsync</option>
                <option value="scp">scp</option>
              </select>
            </div>
            <div>
              <label className="label-base">Retries</label>
              <input
                {...register("retries")}
                type="number"
                className="input-base"
                min={0}
                placeholder="2"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
