import fs from "fs";
import path from "path";
import crypto from "crypto";

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

function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sanitizeFileName(fileName) {
  const baseName = path.basename(fileName);

  if (baseName !== fileName) {
    throw new Error("Solo se permite aprobar archivos por nombre, no rutas completas.");
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

function approveKnowledgeFile(fileName) {
  if (!fileName) {
    throw new Error('Uso: npm run approve-knowledge -- "archivo.md"');
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`No existe configuración de conocimiento: ${CONFIG_PATH}`);
  }

  const config = readJson(CONFIG_PATH);

  if (!config.enabled) {
    throw new Error("La memoria documental está deshabilitada.");
  }

  const safeFileName = sanitizeFileName(fileName);

  const knowledgeRoot = path.resolve(config.knowledgeRoot);
  const inboxDir = path.join(knowledgeRoot, "inbox");
  const approvedDir = path.resolve(config.approvedDir);
  const indexDir = path.resolve(config.indexDir);
  const approvalLogPath = path.join(indexDir, "knowledge-approvals.json");

  ensureDir(inboxDir);
  ensureDir(approvedDir);
  ensureDir(indexDir);

  const sourcePath = path.join(inboxDir, safeFileName);
  const destinationPath = path.join(approvedDir, safeFileName);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No existe el archivo en inbox: ${sourcePath}`);
  }

  if (fs.existsSync(destinationPath)) {
    throw new Error(`El archivo ya existe en approved: ${destinationPath}`);
  }

  const stat = fs.statSync(sourcePath);

  if (!stat.isFile()) {
    throw new Error("Solo se pueden aprobar archivos.");
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const allowedExtensions = config.allowedExtensions ?? [".md", ".txt", ".json"];

  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Extensión no permitida: ${ext}`);
  }

  const maxFileSizeBytes = Number(config.maxFileSizeKB ?? 512) * 1024;

  if (stat.size > maxFileSizeBytes) {
    throw new Error(`Archivo demasiado grande. Máximo permitido: ${config.maxFileSizeKB} KB`);
  }

  const sha256 = hashFile(sourcePath);

  fs.renameSync(sourcePath, destinationPath);

  const approvalLog = loadApprovalLog(approvalLogPath);

  const approvalEntry = {
    fileName: safeFileName,
    sourcePath,
    destinationPath,
    extension: ext,
    sizeBytes: stat.size,
    sha256,
    approvedAt: new Date().toISOString(),
    approvedByRole: "Usuario Administrador designado",
    status: "approved",
    action: "moved_from_inbox_to_approved",
    readOnly: true,
    allowNetwork: false,
    allowExternalProvider: false
  };

  approvalLog.approvals.push(approvalEntry);
  writeJson(approvalLogPath, approvalLog);

  return approvalEntry;
}

try {
  const fileName = process.argv[2];
  const result = approveKnowledgeFile(fileName);

  console.log("");
  console.log("Naye Knowledge Approver");
  console.log("-----------------------");
  console.log("Archivo aprobado:", result.fileName);
  console.log("Acción:", result.action);
  console.log("Destino:", result.destinationPath);
  console.log("SHA256:", result.sha256);
  console.log("Estado:", result.status);
  console.log("");
  console.log("Ahora ejecuta: npm run index-knowledge");
  console.log("");
} catch (error) {
  console.error("");
  console.error("Naye Knowledge Approver — Error");
  console.error("-------------------------------");
  console.error(error.message);
  console.error("");
  process.exit(1);
}
