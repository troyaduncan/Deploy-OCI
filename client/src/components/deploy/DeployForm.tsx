import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DeploymentConfig } from "@deploy-oci/shared";
import { RequiredSection } from "./RequiredSection.tsx";
import { ConnectionSection } from "./ConnectionSection.tsx";
import { ContainerSection } from "./ContainerSection.tsx";
import { AdvancedSection } from "./AdvancedSection.tsx";
import { Rocket, FlaskConical } from "lucide-react";
import { cn } from "../../lib/utils.ts";

const schema = z.object({
  app: z.string().min(1, "App name is required"),
  host: z.string().min(1, "Host is required"),
  remoteUser: z.string().min(1),
  sshPort: z.coerce.number().int().min(1).max(65535),
  sshKeepalive: z.coerce.number().int().min(0),
  sshKeepaliveCount: z.coerce.number().int().min(0),
  projectsDir: z.string().min(1),
  remoteDir: z.string(),
  port: z.string(),
  envFile: z.string(),
  engine: z.enum(["podman", "docker"]),
  tag: z.string().min(1),
  restartPolicy: z.string().min(1),
  useSystemd: z.boolean(),
  systemdScope: z.enum(["auto", "user", "system"]),
  enableLinger: z.boolean(),
  rollback: z.boolean(),
  dryRun: z.boolean(),
  transfer: z.enum(["rsync", "scp"]),
  retries: z.coerce.number().int().min(0),
  keepArchives: z.coerce.number().int().min(0),
  keepImages: z.coerce.number().int().min(0),
});

export type DeployFormValues = z.infer<typeof schema>;

const defaults: DeployFormValues = {
  app: "",
  host: "",
  remoteUser: "adm_tduncan28",
  sshPort: 22,
  sshKeepalive: 20,
  sshKeepaliveCount: 6,
  projectsDir: "~/projects",
  remoteDir: "",
  port: "8080:8080",
  envFile: "",
  engine: "podman",
  tag: "latest",
  restartPolicy: "always",
  useSystemd: false,
  systemdScope: "auto",
  enableLinger: false,
  rollback: false,
  dryRun: false,
  transfer: "rsync",
  retries: 2,
  keepArchives: 5,
  keepImages: 3,
};

interface DeployFormProps {
  onSubmit: (config: DeploymentConfig) => void;
  isDeploying: boolean;
}

export function DeployForm({ onSubmit, isDeploying }: DeployFormProps) {
  const form = useForm<DeployFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(schema),
  });

  const dryRun = form.watch("dryRun");

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values as DeploymentConfig);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <RequiredSection form={form} />
      <ConnectionSection form={form} />
      <ContainerSection form={form} />
      <AdvancedSection form={form} />

      {/* Submit area */}
      <div className="pt-2 space-y-2">
        <button
          type="submit"
          disabled={isDeploying}
          className={cn(
            "btn-primary w-full flex items-center justify-center gap-2",
            dryRun &&
              "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
          )}
        >
          {isDeploying ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Deploying...
            </>
          ) : dryRun ? (
            <>
              <FlaskConical size={16} />
              Dry Run
            </>
          ) : (
            <>
              <Rocket size={16} />
              Deploy
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => form.setValue("dryRun", !dryRun)}
          className={cn(
            "w-full py-1.5 px-3 rounded-md border text-xs font-medium transition-colors",
            dryRun
              ? "border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              : "border-surface-600 text-surface-400 hover:text-surface-200 hover:border-surface-400"
          )}
        >
          {dryRun ? "✓ Dry Run Mode Active" : "Enable Dry Run"}
        </button>
      </div>
    </form>
  );
}
