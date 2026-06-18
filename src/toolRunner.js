import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const REGISTRY_PATH = path.join(ROOT, "config", "tool-registry.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return { tools: [] };
  }

  return readJson(REGISTRY_PATH);
}

function isSystemStatusRequest(input, route) {
  const text = input.toLowerCase();

  return route.taskType === "multi_device" && (
    text.includes("estatus") ||
    text.includes("status") ||
    text.includes("estado") ||
    text.includes("estus") ||
    text.includes("pc")
  );
}

function findActiveTool(toolName) {
  const registry = loadRegistry();

  if (!Array.isArray(registry.tools)) {
    return null;
  }

  return registry.tools.find(tool => {
    return tool.name === toolName &&
      tool.status === "active" &&
      tool.activationStatus === "active";
  }) ?? null;
}

async function runActiveToolIfAvailable({ input, route }) {
  if (isSystemStatusRequest(input, route)) {
    const activeTool = findActiveTool("systemStatus");

    if (!activeTool) {
      return {
        toolExecuted: false,
        reason: "La herramienta systemStatus no está activa."
      };
    }

    const bridgePath = path.join(activeTool.activePackageDir, "bridge", "systemStatusBridge.js");

    if (!fs.existsSync(bridgePath)) {
      throw new Error(`No existe bridge activo para systemStatus: ${bridgePath}`);
    }

    const bridgeUrl = pathToFileURL(bridgePath).href;
    const bridge = await import(`${bridgeUrl}?t=${Date.now()}`);

    if (typeof bridge.runSystemStatusDryRun !== "function") {
      throw new Error("El bridge de systemStatus no exporta runSystemStatusDryRun.");
    }

    const data = bridge.runSystemStatusDryRun();

    return {
      toolExecuted: true,
      provider: "active_local_tool",
      tool: "systemStatus",
      executed: true,
      message: "Herramienta activa systemStatus ejecutada correctamente en modo solo lectura.",
      data
    };
  }

  return {
    toolExecuted: false,
    reason: "No hay herramienta activa aplicable para esta solicitud."
  };
}

export { runActiveToolIfAvailable };
