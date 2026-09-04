import type {
  OperationalActionEngineApiStatus,
  OperationalControlResponse,
  OperationalMissionActivityResponse,
  OperationalMissionAuthorization,
  OperationalMissionOrchestrationStatus,
  OperationalMissionProposal,
  OperationalMissionRunResponse,
  OperationalMissionStatus
} from "./operationalTypes";

const NAYE_API_BASE_URL = "http://127.0.0.1:17890";
const inFlightGetRequests = new Map<string, Promise<unknown>>();

type OperationalRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

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

function errorDetail(data: unknown, status: number): string {
  const source = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return String(
    source.reason ||
    source.error ||
    source.message ||
    `HTTP ${status}`
  );
}

async function performRequestJson<T>(
  endpoint: string,
  options: OperationalRequestOptions = {}
): Promise<T> {
  const method = options.method || "GET";
  const bridge = window.nayeDesktop;

  if (bridge?.operationalRequest) {
    const result = await bridge.operationalRequest({
      endpoint,
      method,
      ...(options.body !== undefined ? { body: options.body } : {})
    });

    if (!result.ok) {
      throw new OperationalApiRequestError(
        `Naye Operational API: ${errorDetail(result.data, result.status)}`,
        result.status,
        result.data
      );
    }

    return result.data as T;
  }

  const response = await fetch(`${NAYE_API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Accept": "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new OperationalApiRequestError(
      `Naye Operational API: ${errorDetail(data, response.status)}`,
      response.status,
      data
    );
  }

  return data as T;
}

function requestJson<T>(
  endpoint: string,
  options: OperationalRequestOptions = {}
): Promise<T> {
  const method = options.method || "GET";

  if (method !== "GET") {
    return performRequestJson<T>(endpoint, options);
  }

  const existing = inFlightGetRequests.get(endpoint) as Promise<T> | undefined;
  if (existing) return existing;

  const request = performRequestJson<T>(endpoint, { ...options, method: "GET" });
  inFlightGetRequests.set(endpoint, request as Promise<unknown>);

  const clear = () => {
    if (inFlightGetRequests.get(endpoint) === request) {
      inFlightGetRequests.delete(endpoint);
    }
  };

  request.then(clear, clear);
  return request;
}

function postJson<T>(endpoint: string, body: unknown): Promise<T> {
  return requestJson<T>(endpoint, {
    method: "POST",
    body
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

export function runOperationalMission(
  missionId: string
): Promise<OperationalMissionRunResponse> {
  return postJson<OperationalMissionRunResponse>(
    `/api/operational/missions/${encodeURIComponent(missionId)}/run`,
    {}
  );
}

export function getOperationalMissionOrchestration(
  missionId: string
): Promise<OperationalMissionOrchestrationStatus> {
  return requestJson<OperationalMissionOrchestrationStatus>(
    `/api/operational/missions/${encodeURIComponent(missionId)}/orchestration`
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
