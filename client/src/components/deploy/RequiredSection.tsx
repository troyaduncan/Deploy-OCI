import type { UseFormReturn } from "react-hook-form";
import type { DeployFormValues } from "./DeployForm.tsx";
import { Server, FolderOpen } from "lucide-react";

interface Props {
  form: UseFormReturn<DeployFormValues>;
}

export function RequiredSection({ form }: Props) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-magenta" />
        Target
      </h3>

      <div>
        <label className="label-base" htmlFor="app">
          <span className="flex items-center gap-1.5">
            <FolderOpen size={12} />
            App Name
            <span className="text-magenta">*</span>
          </span>
        </label>
        <input
          id="app"
          {...register("app")}
          placeholder="Team-Nexus"
          className="input-base"
          autoComplete="off"
        />
        {errors.app && (
          <p className="text-xs text-red-400 mt-1">{errors.app.message}</p>
        )}
      </div>

      <div>
        <label className="label-base" htmlFor="host">
          <span className="flex items-center gap-1.5">
            <Server size={12} />
            Remote Host
            <span className="text-magenta">*</span>
          </span>
        </label>
        <input
          id="host"
          {...register("host")}
          placeholder="dblvlecdd0000a"
          className="input-base"
          autoComplete="off"
        />
        {errors.host && (
          <p className="text-xs text-red-400 mt-1">{errors.host.message}</p>
        )}
      </div>
    </div>
  );
}
