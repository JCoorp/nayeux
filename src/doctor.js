import fs from "fs";
import path from "path";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const LOCAL_MODEL_CONFIG_PATH = path.join(ROOT, "config", "local-model.config.json");
const TOOL_REGISTRY_PATH = path.join(ROOT, "config", "tool-registry.json");
const KNOWLEDGE_CONFIG_PATH = path.join(ROOT, "config", "knowledge.config.json");

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

function checkKnowledge() {
  if (!fs.existsSync(KNOWLEDGE_CONFIG_PATH)) {
    return {
      label: "Knowledge Memory",
      ok: false,
      path: KNOWLEDGE_CONFIG_PATH,
      message: "No existe knowledge.config.json"
    };
  }

  const config = readJson(KNOWLEDGE_CONFIG_PATH);

  if (!config.enabled) {
    return {
      label: "Knowledge Memory",
      ok: false,
      path: KNOWLEDGE_CONFIG_PATH,
      message: "La memoria documental está deshabilitada"
    };
  }

  const approvedDir = path.resolve(config.approvedDir);
  const indexFile = path.resolve(config.indexFile);

  if (!fs.existsSync(approvedDir)) {
    return {
      label: "Knowledge Memory",
      ok: false,
      path: approvedDir,
      message: "No existe la carpeta de documentos aprobados"
    };
  }

  if (!fs.existsSync(indexFile)) {
    return {
      label: "Knowledge Memory",
      ok: false,
      path: indexFile,
      message: "No existe knowledge-index.json. Ejecuta npm run index-knowledge"
    };
  }

  const index = readJson(indexFile);
  const documents = Array.isArray(index.documents) ? index.documents : [];

  return {
    label: "Knowledge Memory",
    ok: documents.length > 0,
    path: indexFile,
    message: documents.length > 0
      ? `Memoria documental activa con ${documents.length} documento(s) indexado(s)`
      : "La memoria existe, pero no tiene documentos indexados",
    approvedDir,
    indexedAt: index.indexedAt,
    documentCount: documents.length,
    documents: documents.map(doc => doc.title)
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

  if (check.documentCount !== undefined) {
    console.log(`     Documentos indexados: ${check.documentCount}`);
  }

  if (check.documents?.length) {
    console.log(`     Documentos: ${check.documents.join(", ")}`);
  }

  if (check.indexedAt) {
    console.log(`     Indexado en: ${check.indexedAt}`);
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
  checks.push(checkFile(KNOWLEDGE_CONFIG_PATH, "knowledge.config.json"));

  let localModelConfig = null;

  if (fs.existsSync(LOCAL_MODEL_CONFIG_PATH)) {
    localModelConfig = readJson(LOCAL_MODEL_CONFIG_PATH);
    checks.push(await checkOllama(localModelConfig));
  }

  checks.push(checkToolRegistry());
  checks.push(checkKnowledge());

  console.log("");

  for (const check of checks) {
    printCheck(check);
  }

  const ollamaCheck = checks.find(check => check.label === "Ollama API");
  const toolCheck = checks.find(check => check.label === "Tool Registry");
  const knowledgeCheck = checks.find(check => check.label === "Knowledge Memory");

  const systemBaseOk = checks.every(check => check.ok);
  const modelOk = ollamaCheck ? ollamaCheck.ok && ollamaCheck.modelFound : false;
  const toolsOk = toolCheck ? toolCheck.ok : false;
  const knowledgeOk = knowledgeCheck ? knowledgeCheck.ok : false;

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Sistema base:", systemBaseOk ? "OK" : "REVISAR");
  console.log("Modelo local listo:", modelOk ? "OK" : "REVISAR");
  console.log("Herramientas activas:", toolsOk ? "OK" : "REVISAR");
  console.log("Memoria documental:", knowledgeOk ? "OK" : "REVISAR");
  console.log("");

  if (!systemBaseOk || !modelOk || !toolsOk || !knowledgeOk) {
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
