import fs from "fs";
import path from "path";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const LOCAL_MODEL_CONFIG_PATH = path.join(ROOT, "config", "local-model.config.json");
const TOOL_REGISTRY_PATH = path.join(ROOT, "config", "tool-registry.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function checkFile(filePath, label) {
  const exists = fs.existsSync(filePath);

  return {
    label,
    ok: exists,
    path: filePath,
    message: exists ? "Existe" : "No existe"
  };
}

async function checkOllama(config) {
  const baseUrl = config.url.replace("/api/generate", "");
  const tagsUrl = `${baseUrl}/api/tags`;

  try {
    const response = await fetch(tagsUrl);

    if (!response.ok) {
      return {
        label: "Ollama API",
        ok: false,
        url: tagsUrl,
        message: `Ollama respondió con estado HTTP ${response.status}`
      };
    }

    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const configuredModel = config.model;

    const modelFound = models.some(model => model.name === configuredModel);

    return {
      label: "Ollama API",
      ok: true,
      url: tagsUrl,
      message: "Ollama está respondiendo",
      configuredModel,
      modelFound,
      installedModels: models.map(model => model.name)
    };
  } catch (error) {
    return {
      label: "Ollama API",
      ok: false,
      url: tagsUrl,
      message: "No se pudo conectar con Ollama",
      error: error.message
    };
  }
}

function checkToolRegistry() {
  if (!fs.existsSync(TOOL_REGISTRY_PATH)) {
    return {
      label: "Tool Registry",
      ok: false,
      path: TOOL_REGISTRY_PATH,
      message: "No existe tool-registry.json"
    };
  }

  const registry = readJson(TOOL_REGISTRY_PATH);
  const tools = Array.isArray(registry.tools) ? registry.tools : [];

  const systemStatus = tools.find(tool => tool.name === "systemStatus");

  return {
    label: "Tool Registry",
    ok: Boolean(systemStatus && systemStatus.status === "active" && systemStatus.activationStatus === "active"),
    path: TOOL_REGISTRY_PATH,
    message: systemStatus
      ? `systemStatus encontrado con status=${systemStatus.status}, activationStatus=${systemStatus.activationStatus}`
      : "systemStatus no está registrado",
    activeTools: tools
      .filter(tool => tool.status === "active" && tool.activationStatus === "active")
      .map(tool => tool.name)
  };
}

function printCheck(check) {
  const icon = check.ok ? "OK" : "ERROR";

  console.log(`[${icon}] ${check.label}: ${check.message}`);

  if (check.configuredModel) {
    console.log(`     Modelo configurado: ${check.configuredModel}`);
    console.log(`     Modelo instalado: ${check.modelFound}`);
  }

  if (check.installedModels?.length) {
    console.log(`     Modelos instalados: ${check.installedModels.join(", ")}`);
  }

  if (check.activeTools?.length) {
    console.log(`     Herramientas activas: ${check.activeTools.join(", ")}`);
  }

  if (check.error) {
    console.log(`     Error: ${check.error}`);
  }
}

async function main() {
  console.log("");
  console.log("Naye Doctor");
  console.log("-----------");

  const checks = [];

  checks.push(checkFile(PACKAGE_PATH, "package.json"));
  checks.push(checkFile(LOCAL_MODEL_CONFIG_PATH, "local-model.config.json"));
  checks.push(checkFile(TOOL_REGISTRY_PATH, "tool-registry.json"));

  let localModelConfig = null;

  if (fs.existsSync(LOCAL_MODEL_CONFIG_PATH)) {
    localModelConfig = readJson(LOCAL_MODEL_CONFIG_PATH);
    checks.push(await checkOllama(localModelConfig));
  }

  checks.push(checkToolRegistry());

  console.log("");

  for (const check of checks) {
    printCheck(check);
  }

  const allOk = checks.every(check => check.ok);
  const ollamaCheck = checks.find(check => check.label === "Ollama API");

  const modelOk = ollamaCheck
    ? ollamaCheck.ok && ollamaCheck.modelFound
    : false;

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Sistema base:", allOk ? "OK" : "REVISAR");
  console.log("Modelo local listo:", modelOk ? "OK" : "REVISAR");
  console.log("");

  if (!allOk || !modelOk) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error("");
  console.error("Naye Doctor — Error");
  console.error("-------------------");
  console.error(error.message);
  console.error("");
  process.exit(1);
});
