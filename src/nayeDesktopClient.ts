import type {
  ActiveSessions,
  DesktopContext,
  NayeStatus,
  NodeProfile,
  OpenClawConfigSummary,
  OpenClawStatus,
  ChatRequest,
  ChatResponse
} from "./types";

const NAYE_API_BASE_URL = "http://127.0.0.1:17890";

async function fetchJson<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${NAYE_API_BASE_URL}${endpoint}`);
  if (!res.ok) throw new Error(`Naye API returned HTTP ${res.status} for ${endpoint}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(endpoint: string, payload: unknown): Promise<T> {
  const res = await fetch(`${NAYE_API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let message = `Naye API returned HTTP ${res.status} for ${endpoint}`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
      if (data?.error) message = `${data.error}: ${message}`;
    } catch {}
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

function requireBridge() {
  return window.nayeDesktop;
}

export async function getDesktopContext(): Promise<DesktopContext> {
  const bridge = requireBridge();
  if (bridge) return bridge.getDesktopContext();

  return {
    appName: "Naye UX Browser Fallback",
    appVersion: "0.3.0",
    mode: "development",
    apiBaseUrl: NAYE_API_BASE_URL,
    renderer: "browser-fallback"
  };
}

export async function getNayeStatus(): Promise<NayeStatus> {
  const bridge = requireBridge();
  if (bridge) return bridge.getStatus();
  return fetchJson<NayeStatus>("/api/status");
}

export async function getOpenClawStatus(): Promise<OpenClawStatus> {
  const bridge = requireBridge();
  if (bridge) return bridge.getOpenClawStatus();
  return fetchJson<OpenClawStatus>("/api/openclaw/status");
}

export async function getOpenClawConfigSummary(): Promise<OpenClawConfigSummary> {
  const bridge = requireBridge();
  if (bridge) return bridge.getOpenClawConfig();
  return fetchJson<OpenClawConfigSummary>("/api/openclaw/config-summary");
}

export async function getNodeProfile(): Promise<NodeProfile> {
  const bridge = requireBridge();
  if (bridge) return bridge.getNodeProfile();
  return fetchJson<NodeProfile>("/api/node/profile");
}

export async function getActiveSessions(): Promise<ActiveSessions> {
  const bridge = requireBridge();
  if (bridge) return bridge.getActiveSessions();
  return fetchJson<ActiveSessions>("/api/sessions/active");
}

export async function sendChatMessage(message: string, sessionId?: string | null): Promise<ChatResponse> {
  const payload: ChatRequest = { message, sessionId: sessionId || null };
  const bridge = requireBridge();
  if (bridge) return bridge.sendChat(payload);
  return postJson<ChatResponse>("/api/chat", payload);
}
