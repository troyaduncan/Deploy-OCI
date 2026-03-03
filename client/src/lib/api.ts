import type { DeploymentConfig, DeploymentRecord } from "@deploy-oci/shared";

const BASE = "/api";

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  startDeployment(config: DeploymentConfig): Promise<{ id: string }> {
    return fetchJson(`${BASE}/deployments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  },

  getDeployments(params?: {
    page?: number;
    limit?: number;
    app?: string;
  }): Promise<{ records: DeploymentRecord[]; total: number }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.app) qs.set("app", params.app);
    return fetchJson(`${BASE}/deployments?${qs}`);
  },

  getDeployment(id: string): Promise<DeploymentRecord> {
    return fetchJson(`${BASE}/deployments/${id}`);
  },

  cancelDeployment(id: string): Promise<{ cancelled: boolean; deleted?: boolean }> {
    return fetchJson(`${BASE}/deployments/${id}`, { method: "DELETE" });
  },
};
