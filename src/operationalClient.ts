import type {
  OperationalActionEngineApiStatus,
  OperationalControlResponse,
  OperationalMissionActivityResponse,
  OperationalMissionAuthorization,
  OperationalMissionProposal,
  OperationalMissionStatus
} from "./operationalTypes";

const NAYE_API_BASE_URL = "http://127.0.0.1:17890";

export class OperationalApiRequestError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "OperationalApiRequestError";
    this.status = status;
    this.body = body;
  }
}

async function requestJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${NAYE_API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const source = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const detail = String(
      source.reason ||
      source.error ||
      source.message ||
      `HTTP ${response.status}`
    );
    throw new OperationalApiRequestError(
      `Naye Operational API: ${detail}`,
      response.status,
      data
    );
  }

  return data as T;
}

function postJson<T>(endpoint: string, body: unknown): Promise<T> {
  return requestJson<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function getOperationalActionEngineStatus(): Promise<OperationalActionEngineApiStatus> {
  return requestJson<OperationalActionEngineApiStatus>(
    "/api/operational/action-engine/status"
  );
}

export function proposeOperationalMission(input: {
  objective: string;
  requestedBy: Record<string, unknown>;
  risk?: string;
  allowedCapabilities: string[];
  resourceIds?: string[];
  workspaceRoots: string[];
  maxActions?: number;
  durationMs?: number;
  rollbackRequired?: boolean;
  verificationRequired?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<OperationalMissionProposal> {
  return postJson<OperationalMissionProposal>(
    "/api/operational/missions",
    input
  );
}

export function authorizeOperationalMission(
  missionId: string,
  actor: Record<string, unknown>
): Promise<OperationalMissionAuthorization> {
  return postJson<OperationalMissionAuthorization>(
    `/api/operational/missions/${encodeURIComponent(missionId)}/authorize`,
    {
      confirm: "MISSION_APPROVED",
      actor,
      metadata: {
        source: "naye_desktop_ux",
        approvalMode: "mission_scope_once"
      }
    }
  );
}

export function getOperationalMissionStatus(
  missionId: string
): Promise<OperationalMissionStatus> {
  return requestJson<OperationalMissionStatus>(
    `/api/operational/missions/${encodeURIComponent(missionId)}`
  );
}

export function getOperationalMissionActivity(
  missionId: string
): Promise<OperationalMissionActivityResponse> {
  return requestJson<OperationalMissionActivityResponse>(
    `/api/operational/missions/${encodeURIComponent(missionId)}/activity`
  );
}

export function controlOperationalMission(
  missionId: string,
  type: "pause" | "resume" | "stop" | "rollback",
  actor: Record<string, unknown>,
  reason: string
): Promise<OperationalControlResponse> {
  return postJson<OperationalControlResponse>(
    `/api/operational/missions/${encodeURIComponent(missionId)}/control`,
    {
      confirm: "MISSION_CONTROL_APPROVED",
      type,
      actor,
      reason,
      metadata: {
        source: "naye_desktop_ux"
      }
    }
  );
}

export function revokeOperationalMission(
  missionId: string,
  actor: Record<string, unknown>,
  reason: string
): Promise<{ revoked?: boolean; reason?: string }> {
  return postJson(
    `/api/operational/missions/${encodeURIComponent(missionId)}/revoke`,
    {
      confirm: "MISSION_REVOKE_APPROVED",
      actor,
      reason,
      metadata: {
        source: "naye_desktop_ux"
      }
    }
  );
}
