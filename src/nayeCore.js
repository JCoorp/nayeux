import { routeTask } from "./modelRouter.js";
import { runLocalModel } from "./providers/localRunner.js";
import { runOpenAIModel } from "./providers/openaiRunner.js";

async function processWithNaye({ input, jcPermissionForCloud = false, cloudEnabled = false }) {
  const route = routeTask({ input, jcPermissionForCloud });

  if (route.blockedExternal) {
    const localResult = await runLocalModel({
      input,
      taskType: route.taskType,
      sensitivity: route.sensitivity
    });

    return {
      status: "protected_execution",
      decision: route,
      result: localResult
    };
  }

  if (route.requiresPermission && !jcPermissionForCloud) {
    return {
      status: "permission_required",
      decision: route,
      result: {
        executed: false,
        message: "La tarea requiere autorización de JC antes de usar un proveedor externo. Por seguridad, Naye recomienda local."
      }
    };
  }

  if (route.recommendedProvider === "local") {
    const localResult = await runLocalModel({
      input,
      taskType: route.taskType,
      sensitivity: route.sensitivity
    });

    return {
      status: "local_selected",
      decision: route,
      result: localResult
    };
  }

  if (route.recommendedProvider === "openai_or_local") {
    const openAIResult = await runOpenAIModel({
      input,
      taskType: route.taskType,
      sensitivity: route.sensitivity,
      cloudEnabled
    });

    return {
      status: cloudEnabled ? "cloud_selected_dry_run" : "cloud_available_but_disabled",
      decision: route,
      result: openAIResult
    };
  }

  const fallbackResult = await runLocalModel({
    input,
    taskType: route.taskType,
    sensitivity: route.sensitivity
  });

  return {
    status: "fallback_local",
    decision: route,
    result: fallbackResult
  };
}

export { processWithNaye };
