export type OperationalCapability = {
  id?: string | null;
  version?: string | null;
  capability?: string | null;
  capabilityVersion?: string | null;
  implementationHash?: string | null;
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
  metadata?: Record<string, unknown>;
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

export type OperationalOrchestratorSnapshot = {
  missionId?: string;
  runId?: string | null;
  state?: string;
  reason?: string;
  terminal?: boolean;
  retryable?: boolean;
  cursor?: number;
  planningAttempts?: number;
  currentStep?: Record<string, unknown> | null;
  capabilityGap?: Record<string, unknown> | null;
  development?: Record<string, unknown> | null;
  stepResults?: Array<Record<string, unknown>>;
};

export type OperationalMissionOrchestrationStatus = {
  schema?: string;
  version?: string;
  id?: string;
  missionId?: string;
  available?: boolean;
  runnable?: boolean;
  liveRuntimeConstructed?: boolean;
  running?: boolean;
  automaticExecution?: boolean;
  modelIsAuthority?: boolean;
  sourceAuthorIsAuthority?: boolean;
  humanAuthorityRequired?: boolean;
  hardSemanticCapabilityCeilingEncoded?: boolean;
  missionHash?: string | null;
  authorizationActive?: boolean;
  control?: OperationalControlState | null;
  runtime?: {
    runtimeId?: string;
    authorizationId?: string;
    policy?: {
      maxPlanSteps?: number | null;
      maxPlanningAttempts?: number | null;
      maxCapabilityDevelopmentAttempts?: number | null;
      source?: string;
      hardMaximumEncoded?: boolean;
    };
    developmentRoot?: string;
    orchestrator?: OperationalOrchestratorSnapshot;
  } | null;
};

export type OperationalMissionRunResponse = {
  schema?: string;
  version?: string;
  missionId?: string;
  runtimeId?: string;
  started?: boolean;
  completed?: boolean;
  retryable?: boolean;
  reason?: string;
  error?: string;
  result?: OperationalOrchestratorSnapshot | null;
  automaticExecution?: boolean;
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
