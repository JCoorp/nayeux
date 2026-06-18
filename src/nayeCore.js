import { routeTask } from "./modelRouter.js";
import { runLocalModel } from "./providers/localRunner.js";
import { runOpenAIModel } from "./providers/openaiRunner.js";
import { writeDecisionLog } from "./utils/auditLogger.js";

async function finalizeProcess({
  input,
  route,
  status,
  result,
  cloudEnabled,
  jcPermissionForCloud
}) {
  const audit = writeDecisionLog({
    input,
    route,
    status,
    result,
    cloudEnabled,
    jcPermissionForCloud
  });

  return {
    status,
    decision: route,
    result,
    audit
  };
}

async function processWithNaye({ input, jcPermissionForCloud = false, cloudEnabled = false }) {
  const route = routeTask({ input, jcPermissionForCloud });

  if (route.blockedExternal) {
    const localResult = await runLocalModel({
      input,
      taskType: route.taskType,
      sensitivity: route.sensitivity
    });

    return finalizeProcess({
      input,
      route,
      status: "protected_execution",
      result: localResult,
      cloudEnabled,
      jcPermissionForCloud
    });
  }

  if (route.requiresPermission && !jcPermissionForCloud) {
    const result = {
      provider: "none",
      executed: false,
      message: "La tarea requiere autorización de JC antes de usar un proveedor externo. Por seguridad, Naye recomienda local."
    };

    return finalizeProcess({
      input,
      route,
      status: "permission_required",
      result,
      cloudEnabled,
      jcPermissionForCloud
    });
  }

  if (route.recommendedProvider === "local") {
    const localResult = await runLocalModel({
      input,
      taskType: route.taskType,
      sensitivity: route.sensitivity
    });

    return finalizeProcess({
      input,
      route,
      status: "local_selected",
      result: localResult,
      cloudEnabled,
      jcPermissionForCloud
    });
  }

  if (route.recommendedProvider === "openai_or_local") {
    const openAIResult = await runOpenAIModel({
      input,
      taskType: route.taskType,
      sensitivity: route.sensitivity,
      cloudEnabled
    });

    return finalizeProcess({
      input,
      route,
      status: cloudEnabled ? "cloud_selected_dry_run" : "cloud_available_but_disabled",
      result: openAIResult,
      cloudEnabled,
      jcPermissionForCloud
    });
  }

  const fallbackResult = await runLocalModel({
    input,
    taskType: route.taskType,
    sensitivity: route.sensitivity
  });

  return finalizeProcess({
    input,
    route,
    status: "fallback_local",
    result: fallbackResult,
    cloudEnabled,
    jcPermissionForCloud
  });
}

export { processWithNaye };
