import fs from "fs";
import path from "path";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const CONFIG_PATH = path.join(ROOT, "config", "knowledge.config.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFileName(fileName) {
  const baseName = path.basename(fileName);

  if (baseName !== fileName) {
    throw new Error("Solo se permite archivar archivos por nombre, no rutas completas.");
  }

  if (baseName.includes("..")) {
    throw new Error("Nombre de archivo inválido.");
  }

  return baseName;
}

function loadApprovalLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return {
      system: "Naye Core",
      component: "Knowledge Approver",
      authorizationRole: "Usuario Administrador designado",
      approvals: []
    };
  }

  return readJson(logPath);
}

function archiveKnowledgeFile(fileName) {
  if (!fileName) {
    throw new Error('Uso: npm run archive-knowledge -- "archivo.md"');
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`No existe configuración de conocimiento: ${CONFIG_PATH}`);
  }

  const config = readJson(CONFIG_PATH);
  const safeFileName = sanitizeFileName(fileName);

  const knowledgeRoot = path.resolve(config.knowledgeRoot);
  const approvedDir = path.resolve(config.approvedDir);
  const indexDir = path.resolve(config.indexDir);
  const archiveDir = path.join(knowledgeRoot, "archive");
  const approvalLogPath = path.join(indexDir, "knowledge-approvals.json");

  ensureDir(approvedDir);
  ensureDir(indexDir);
  ensureDir(archiveDir);

  const sourcePath = path.join(approvedDir, safeFileName);
  const archivePath = path.join(archiveDir, safeFileName);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No existe el archivo en approved: ${sourcePath}`);
  }

  const stat = fs.statSync(sourcePath);

  if (!stat.isFile()) {
    throw new Error("Solo se pueden archivar archivos.");
  }

  if (fs.existsSync(archivePath)) {
    throw new Error(`El archivo ya existe en archive: ${archivePath}`);
  }

  fs.renameSync(sourcePath, archivePath);

  const approvalLog = loadApprovalLog(approvalLogPath);
  let foundPriorApproval = false;

  approvalLog.approvals = (approvalLog.approvals ?? []).map(entry => {
    if (entry.fileName !== safeFileName) {
      return entry;
    }

    foundPriorApproval = true;

    return {
      ...entry,
      status: "archived",
      archivedAt: new Date().toISOString(),
      archivePath,
      previousApprovedPath: sourcePath,
      action: "archived_from_approved"
    };
  });

  if (!foundPriorApproval) {
    approvalLog.approvals.push({
      fileName: safeFileName,
      sourcePath,
      archivePath,
      archivedAt: new Date().toISOString(),
      approvedByRole: "Usuario Administrador designado",
      status: "archived",
      action: "archived_without_prior_formal_approval",
      readOnly: true,
      allowNetwork: false,
      allowExternalProvider: false
    });
  }

  writeJson(approvalLogPath, approvalLog);

  return {
    fileName: safeFileName,
    sourcePath,
    archivePath,
    foundPriorApproval,
    status: "archived"
  };
}

try {
  const fileName = process.argv[2];
  const result = archiveKnowledgeFile(fileName);

  console.log("");
  console.log("Naye Knowledge Archiver");
  console.log("-----------------------");
  console.log("Archivo archivado:", result.fileName);
  console.log("Origen:", result.sourcePath);
  console.log("Archive:", result.archivePath);
  console.log("Tenía aprobación formal previa:", result.foundPriorApproval);
  console.log("Estado:", result.status);
  console.log("");
  console.log("Ahora ejecuta: npm run index-knowledge");
  console.log("");
} catch (error) {
  console.error("");
  console.error("Naye Knowledge Archiver — Error");
  console.error("--------------------------------");
  console.error(error.message);
  console.error("");
  process.exit(1);
}
