import type { ActiveSessions, ConnectionState, NodeProfile, OpenClawConfigSummary, OpenClawStatus, SystemSnapshot } from "./types";

export function getOpenClawState(openClawStatus?: OpenClawStatus | null): ConnectionState {
  const bridge = openClawStatus?.bridge;
  if (!bridge) return "unknown";
  if (bridge.timedOut) return "timeout";
  if (bridge.ok === true && bridge.statusDetected === "ok") return "online";
  if (bridge.statusDetected === "review") return "review";
  if (bridge.ok === false) return "offline";
  return "unknown";
}

export function getApiState(snapshot: SystemSnapshot): ConnectionState {
  if (snapshot.status?.status === "running") return "online";
  if (snapshot.loading) return "unknown";
  if (snapshot.error) return "error";
  return "offline";
}

export function getGatewayUrl(snapshot: SystemSnapshot): string {
  return snapshot.status?.openClawGateway || "ws://127.0.0.1:18789";
}

export function getConfigState(config?: OpenClawConfigSummary | null): ConnectionState {
  if (config?.config?.found === true && config.config.sanitized?.secretsRedacted === true) return "online";
  if (config?.config?.found === true) return "review";
  if (config?.config?.found === false) return "offline";
  return "unknown";
}

export function extractPlugins(stdout?: string): string[] {
  if (!stdout) return [];
  const match = stdout.match(/\((\d+) plugins?:\s*([^\)]+)\)/i);
  if (!match?.[2]) return [];
  return match[2]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toSafePathLabel(path?: string): string {
  if (!path) return "No disponible";
  const parts = path.split(/\\|\//g).filter(Boolean);
  const tail = parts.slice(-3).join("/");
  return tail ? `…/${tail}` : "Ruta local detectada";
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function getProfileValue(profile: NodeProfile | null | undefined, keys: string[], fallback = "No disponible") {
  const record = asRecord(profile);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "Sí" : "No";
  }
  return fallback;
}

export function getSessionCount(activeSessions: ActiveSessions | null | undefined): number {
  if (Array.isArray(activeSessions)) return activeSessions.length;
  const record = asRecord(activeSessions);

  const candidates = [record.sessions, record.activeSessions, record.items, record.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.length;
  }

  if (typeof record.count === "number") return record.count;
  if (typeof record.activeCount === "number") return record.activeCount;

  return 0;
}

export function formatDate(date?: string | null) {
  if (!date) return "No disponible";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "medium"
  });
}

export function getStateLabel(state: ConnectionState) {
  const labels: Record<ConnectionState, string> = {
    online: "Conectado",
    offline: "Offline",
    review: "Revisión",
    error: "Error",
    timeout: "Timeout",
    unknown: "Sin verificar"
  };
  return labels[state];
}
