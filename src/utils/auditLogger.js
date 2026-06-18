import fs from "fs";
import path from "path";

const RUNTIME_LOG_DIR = path.resolve("F:/NayeVault/naye-core/logs/runtime");

function ensureRuntimeLogDir() {
  if (!fs.existsSync(RUNTIME_LOG_DIR)) {
    fs.mkdirSync(RUNTIME_LOG_DIR, { recursive: true });
  }
}

function maskInputBySensitivity(input, sensitivity) {
  if (sensitivity === "critical") {
    return "[REDACTED_CRITICAL_INPUT]";
  }

  if (sensitivity === "confidential") {
    return input.length > 120 ? input.slice(0, 120) + "..." : input;
  }

  if (sensitivity === "private") {
    return input.length > 100 ? input.slice(0, 100) + "..." : input;
  }

  return input;
}

function createSafeLogFileName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `naye-runtime-${timestamp}.json`;
}

function writeDecisionLog({
  input,
  route,
  status,
  result,
  cloudEnabled,
  jcPermissionForCloud
}) {
  ensureRuntimeLogDir();

  const safeInput = maskInputBySensitivity(input, route.sensitivity);
  const fileName = createSafeLogFileName();
  const filePath = path.join(RUNTIME_LOG_DIR, fileName);

  const logEntry = {
    system: "Naye Core",
    component: "Runtime Audit Logger",
    timestamp: new Date().toISOString(),
    mode: route.mode,
    task: {
      inputPreview: safeInput,
      taskType: route.taskType,
      sensitivity: route.sensitivity
    },
    routingDecision: {
      recommendedProvider: route.recommendedProvider,
      requiresPermission: route.requiresPermission,
      blockedExternal: route.blockedExternal,
      reason: route.reason
    },
    executionContext: {
      cloudEnabled,
      jcPermissionForCloud,
      finalStatus: status,
      provider: result.provider ?? "none",
      executed: result.executed ?? false,
      resultMessage: result.message ?? "No message"
    },
    security: {
      criticalInputRedacted: route.sensitivity === "critical",
      externalProviderBlocked: route.blockedExternal,
      externalProviderUsed: false
    }
  };

  fs.writeFileSync(filePath, JSON.stringify(logEntry, null, 2), "utf8");

  return {
    logged: true,
    filePath
  };
}

export { writeDecisionLog };
