export type OperationalCapability = {
  id?: string | null;
  version?: string | null;
  capability?: string | null;
  available?: boolean;
  automaticExecution?: boolean;
  hasExecutor?: boolean;
};

export type OperationalActionEngineStatus = {
  schema?: string;
  version?: string;
  id?: string;
  available?: boolean;
  acceptingNewAdmissions?: boolean;
  automaticExecution?: boolean;
  processRestartMissionRecovery?: boolean;
  powerLossDurabilityClaimed?: boolean;
  proposedMissionCount?: number;
  authorizedMissionCount?: number;
  activeRuntimeCount?: number;
  capabilityCount?: number;
  capabilities?: OperationalCapability[];
  activityChain?: {
    valid?: boolean;
    reason?: string;
    checkedEvents?: number;
    headHash?: string | null;
  };
};

export type OperationalActionEngineApiStatus = {
  schema?: string;
  routerVersion?: string;
  actionEngine?: OperationalActionEngineStatus;
};

export type OperationalMission = {
  missionId: string;
  missionHash?: string;
  objective?: string;
  risk?: string;
  requestedBy?: Record<string, unknown>;
  createdAt?: string;
  expiresAt?: string;
  scope?: {
    allowedCapabilities?: string[];
    resourceIds?: string[];
    workspaceRoots?: string[];
    maxActions?: number;
  };
};

export type OperationalMissionProposal = {
  proposed?: boolean;
  reason?: string;
  mission?: OperationalMission;
  automaticExecution?: boolean;
};

export type OperationalMissionAuthorization = {
  authorized?: boolean;
  activated?: boolean;
  reason?: string;
  authorization?: Record<string, unknown> | null;
  runtime?: Record<string, unknown> | null;
  activationError?: string | null;
  automaticExecution?: boolean;
};

export type OperationalControlState = {
  schema?: string;
  version?: string;
  missionId?: string;
  revision?: number;
  state?: string;
  desiredState?: string;
  terminal?: boolean;
  lastCommand?: Record<string, unknown> | null;
};

export type OperationalActivityEvent = {
  eventId?: string;
  missionId?: string;
  type?: string;
  summary?: string;
  timestamp?: string;
  actor?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  hash?: string;
  previousHash?: string | null;
};

export type OperationalMissionStatus = {
  schema?: string;
  version?: string;
  mission?: OperationalMission;
  authorization?: Record<string, unknown> | null;
  control?: OperationalControlState | null;
  runtime?: {
    available?: boolean;
    acceptingNewAdmissions?: boolean;
    automaticExecution?: boolean;
    processRestartMissionRecovery?: boolean;
    registry?: {
      capabilityCount?: number;
      capabilities?: OperationalCapability[];
    };
    authorization?: {
      active?: boolean;
      useCount?: number;
      maxActions?: number;
      remainingActions?: number;
    };
  } | null;
  activationError?: string | null;
  activity?: OperationalActivityEvent[];
  automaticExecution?: boolean;
  processRestartMissionRecovery?: boolean;
};

export type OperationalMissionActivityResponse = {
  schema?: string;
  missionId?: string;
  activity?: OperationalActivityEvent[];
};

export type OperationalControlResponse = {
  accepted?: boolean;
  reason?: string;
  state?: OperationalControlState;
};

export type OperationalApiError = {
  error?: string;
  reason?: string;
  message?: string;
};
