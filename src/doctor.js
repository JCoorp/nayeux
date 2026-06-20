import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const LOCAL_MODEL_CONFIG_PATH = path.join(ROOT, "config", "local-model.config.json");
const TOOL_REGISTRY_PATH = path.join(ROOT, "config", "tool-registry.json");
const KNOWLEDGE_CONFIG_PATH = path.join(ROOT, "config", "knowledge.config.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(item => item.isFile())
    .map(item => item.name)
    .sort();
}

function checkFile(filePath, label) {
  const ok = fs.existsSync(filePath);
  return { label, ok, message: ok ? "Existe" : "No existe" };
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
        message: `Ollama respondió con estado HTTP ${response.status}`
      };
    }

    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const installedModels = models.map(model => model.name);
    const modelFound = installedModels.includes(config.model);

    return {
      label: "Ollama API",
      ok: true,
      message: "Ollama está respondiendo",
      configuredModel: config.model,
      modelFound,
      installedModels
    };
  } catch (error) {
    return {
      label: "Ollama API",
      ok: false,
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
      message: "No existe tool-registry.json"
    };
  }

  const registry = readJson(TOOL_REGISTRY_PATH);
  const tools = Array.isArray(registry.tools) ? registry.tools : [];
  const activeTools = tools
    .filter(tool => tool.status === "active" && tool.activationStatus === "active")
    .map(tool => tool.name);

  const systemStatus = tools.find(tool => tool.name === "systemStatus");

  return {
    label: "Tool Registry",
    ok: Boolean(systemStatus && systemStatus.status === "active" && systemStatus.activationStatus === "active"),
    message: systemStatus
      ? `systemStatus encontrado con status=${systemStatus.status}, activationStatus=${systemStatus.activationStatus}`
      : "systemStatus no está registrado",
    activeTools
  };
}

function checkKnowledge() {
  if (!fs.existsSync(KNOWLEDGE_CONFIG_PATH)) {
    return {
      label: "Knowledge Memory",
      ok: false,
      archiveOk: false,
      message: "No existe knowledge.config.json"
    };
  }

  const config = readJson(KNOWLEDGE_CONFIG_PATH);

  if (!config.enabled) {
    return {
      label: "Knowledge Memory",
      ok: false,
      archiveOk: false,
      message: "La memoria documental está deshabilitada"
    };
  }

  const knowledgeRoot = path.resolve(config.knowledgeRoot);
  const approvedDir = path.resolve(config.approvedDir);
  const archiveDir = path.join(knowledgeRoot, "archive");
  const indexFile = path.resolve(config.indexFile);
  const approvalLogPath = path.join(path.resolve(config.indexDir), "knowledge-approvals.json");

  if (!fs.existsSync(indexFile)) {
    return {
      label: "Knowledge Memory",
      ok: false,
      archiveOk: false,
      message: "No existe knowledge-index.json. Ejecuta npm run index-knowledge"
    };
  }

  const approvedFiles = listFiles(approvedDir);
  const archiveFiles = listFiles(archiveDir);

  const index = readJson(indexFile);
  const documents = Array.isArray(index.documents) ? index.documents : [];
  const indexedDocuments = documents.map(doc => doc.relativePath ?? doc.title).sort();

  let approvals = [];
  let approvalLogExists = false;

  if (fs.existsSync(approvalLogPath)) {
    approvalLogExists = true;
    const approvalLog = readJson(approvalLogPath);
    approvals = Array.isArray(approvalLog.approvals) ? approvalLog.approvals : [];
  }

  const activeApprovals = approvals.filter(item => item.status !== "archived");
  const archivedApprovals = approvals.filter(item => item.status === "archived");

  const activeApprovedDocuments = activeApprovals.map(item => item.fileName).sort();
  const archivedDocuments = archivedApprovals.map(item => item.fileName).sort();

  const approvedSet = new Set(approvedFiles);
  const indexSet = new Set(indexedDocuments);
  const archiveSet = new Set(archiveFiles);

  const approvedButNotIndexed = approvedFiles.filter(file => !indexSet.has(file));
  const indexedButNotApproved = indexedDocuments.filter(file => !approvedSet.has(file));
  const activeApprovalMissingApprovedFile = activeApprovedDocuments.filter(file => !approvedSet.has(file));
  const archivedMissingArchiveFile = archivedDocuments.filter(file => !archiveSet.has(file));
  const archivedStillApproved = archivedDocuments.filter(file => approvedSet.has(file));

  const knowledgeOk =
    documents.length > 0 &&
    approvedButNotIndexed.length === 0 &&
    indexedButNotApproved.length === 0 &&
    activeApprovalMissingApprovedFile.length === 0;

  const archiveOk =
    archivedMissingArchiveFile.length === 0 &&
    archivedStillApproved.length === 0;

  return {
    label: "Knowledge Memory",
    ok: knowledgeOk,
    archiveOk,
    message: `Memoria documental activa con ${documents.length} documento(s) indexado(s)`,
    documentCount: documents.length,
    indexedDocuments,
    approvalLogExists,
    activeApprovalCount: activeApprovals.length,
    activeApprovedDocuments,
    archivedApprovalCount: archivedApprovals.length,
    archivedDocuments,
    archiveFiles,
    approvedButNotIndexed,
    indexedButNotApproved,
    activeApprovalMissingApprovedFile,
    archivedMissingArchiveFile,
    archivedStillApproved,
    indexedAt: index.indexedAt
  };
}


function checkOpenClaw() {
  const scriptPath = path.join(ROOT, "src", "openclawStatus.js");

  if (!fs.existsSync(scriptPath)) {
    return {
      label: "OpenClaw Fresh",
      ok: false,
      message: "No existe src/openclawStatus.js"
    };
  }

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    encoding: "utf8"
  });

  return {
    label: "OpenClaw Fresh",
    ok: result.status === 0,
    message: result.status === 0
      ? "OpenClaw Fresh y agentes validados"
      : "OpenClaw requiere revisión",
    openclawStatusCode: result.status,
    error: result.error?.message ?? null
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
    console.log(`     Documentos indexados activos: ${check.documentCount}`);
  }

  if (check.indexedDocuments?.length) {
    console.log(`     Indexados activos: ${check.indexedDocuments.join(", ")}`);
  }

  if (check.approvalLogExists !== undefined) {
    console.log(`     Registro de aprobaciones: ${check.approvalLogExists ? "Existe" : "No existe"}`);
  }

  if (check.activeApprovalCount !== undefined) {
    console.log(`     Aprobaciones formales activas: ${check.activeApprovalCount}`);
  }

  if (check.activeApprovedDocuments?.length) {
    console.log(`     Aprobados activos: ${check.activeApprovedDocuments.join(", ")}`);
  }

  if (check.archivedApprovalCount !== undefined) {
    console.log(`     Archivados formalmente: ${check.archivedApprovalCount}`);
  }

  if (check.archivedDocuments?.length) {
    console.log(`     Documentos archivados: ${check.archivedDocuments.join(", ")}`);
  }

  if (check.archiveFiles?.length) {
    console.log(`     Archivos en archive: ${check.archiveFiles.join(", ")}`);
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

  const baseChecks = [
    checkFile(PACKAGE_PATH, "package.json"),
    checkFile(LOCAL_MODEL_CONFIG_PATH, "local-model.config.json"),
    checkFile(TOOL_REGISTRY_PATH, "tool-registry.json"),
    checkFile(KNOWLEDGE_CONFIG_PATH, "knowledge.config.json")
  ];

  const checks = [...baseChecks];

  if (fs.existsSync(LOCAL_MODEL_CONFIG_PATH)) {
    checks.push(await checkOllama(readJson(LOCAL_MODEL_CONFIG_PATH)));
  }

  checks.push(checkToolRegistry());
  checks.push(checkKnowledge());
  checks.push(checkOpenClaw());

  console.log("");

  for (const check of checks) {
    printCheck(check);
  }

  const ollamaCheck = checks.find(check => check.label === "Ollama API");
  const toolCheck = checks.find(check => check.label === "Tool Registry");
  const knowledgeCheck = checks.find(check => check.label === "Knowledge Memory");
  const openclawCheck = checks.find(check => check.label === "OpenClaw Fresh");

  const systemBaseOk = baseChecks.every(check => check.ok);
  const modelOk = ollamaCheck ? ollamaCheck.ok && ollamaCheck.modelFound : false;
  const toolsOk = toolCheck ? toolCheck.ok : false;
  const knowledgeOk = knowledgeCheck ? knowledgeCheck.ok : false;
  const approvalsOk = knowledgeCheck
    ? knowledgeCheck.approvalLogExists && knowledgeCheck.activeApprovalCount > 0
    : false;
  const archiveOk = knowledgeCheck ? knowledgeCheck.archiveOk : false;
  const openclawOk = openclawCheck ? openclawCheck.ok : false;

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Sistema base:", systemBaseOk ? "OK" : "REVISAR");
  console.log("Modelo local listo:", modelOk ? "OK" : "REVISAR");
  console.log("Herramientas activas:", toolsOk ? "OK" : "REVISAR");
  console.log("Memoria documental:", knowledgeOk ? "OK" : "REVISAR");
  console.log("Aprobaciones documentales:", approvalsOk ? "OK" : "REVISAR");
  console.log("Archivado documental:", archiveOk ? "OK" : "REVISAR");
  console.log("OpenClaw Fresh:", openclawOk ? "OK" : "REVISAR");
  console.log("");

  if (!systemBaseOk || !modelOk || !toolsOk || !knowledgeOk || !approvalsOk || !archiveOk || !openclawOk) {
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

