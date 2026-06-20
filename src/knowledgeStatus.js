import fs from "fs";
import path from "path";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const CONFIG_PATH = path.join(ROOT, "config", "knowledge.config.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort();
}

function printList(title, items) {
  console.log("");
  console.log(title);
  console.log("-".repeat(title.length));

  if (!items.length) {
    console.log("(vacío)");
    return;
  }

  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function main() {
  console.log("");
  console.log("Naye Knowledge Status");
  console.log("---------------------");

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("No existe config/knowledge.config.json");
    process.exit(1);
  }

  const config = readJson(CONFIG_PATH);

  const knowledgeRoot = path.resolve(config.knowledgeRoot);
  const inboxDir = path.join(knowledgeRoot, "inbox");
  const approvedDir = path.resolve(config.approvedDir);
  const indexFile = path.resolve(config.indexFile);
  const approvalLogPath = path.join(path.resolve(config.indexDir), "knowledge-approvals.json");

  const inboxFiles = listFiles(inboxDir);
  const approvedFiles = listFiles(approvedDir);

  let indexedDocs = [];
  let indexedNames = [];

  if (fs.existsSync(indexFile)) {
    const index = readJson(indexFile);
    indexedDocs = Array.isArray(index.documents) ? index.documents : [];
    indexedNames = indexedDocs.map(doc => doc.relativePath ?? doc.title).sort();
  }

  let approvals = [];
  let approvedFormalNames = [];

  if (fs.existsSync(approvalLogPath)) {
    const approvalLog = readJson(approvalLogPath);
    approvals = Array.isArray(approvalLog.approvals) ? approvalLog.approvals : [];
    approvedFormalNames = approvals.map(item => item.fileName).sort();
  }

  const approvedSet = new Set(approvedFiles);
  const indexedSet = new Set(indexedNames);
  const formalSet = new Set(approvedFormalNames);

  const approvedButNotIndexed = approvedFiles.filter(file => !indexedSet.has(file));
  const indexedButNotApprovedFolder = indexedNames.filter(file => !approvedSet.has(file));
  const approvedButNoFormalRecord = approvedFiles.filter(file => !formalSet.has(file));
  const formalButNotApprovedFolder = approvedFormalNames.filter(file => !approvedSet.has(file));

  console.log("");
  console.log("Configuración");
  console.log("-------------");
  console.log("Memoria habilitada:", config.enabled);
  console.log("Knowledge root:", knowledgeRoot);
  console.log("Inbox:", inboxDir);
  console.log("Approved:", approvedDir);
  console.log("Index:", indexFile);
  console.log("Approval log:", approvalLogPath);

  printList("Inbox pendientes", inboxFiles);
  printList("Approved folder", approvedFiles);
  printList("Indexados", indexedNames);
  printList("Aprobados formalmente", approvedFormalNames);

  printList("Approved pero no indexados", approvedButNotIndexed);
  printList("Indexados pero no están en approved", indexedButNotApprovedFolder);
  printList("Approved sin registro formal", approvedButNoFormalRecord);
  printList("Registro formal pero no está en approved", formalButNotApprovedFolder);

  console.log("");
  console.log("Resumen");
  console.log("-------");
  console.log("Inbox pendientes:", inboxFiles.length);
  console.log("Archivos en approved:", approvedFiles.length);
  console.log("Documentos indexados:", indexedNames.length);
  console.log("Aprobaciones formales:", approvedFormalNames.length);

  const hasWarnings =
    approvedButNotIndexed.length > 0 ||
    indexedButNotApprovedFolder.length > 0 ||
    formalButNotApprovedFolder.length > 0;

  console.log("Estado:", hasWarnings ? "REVISAR" : "OK");

  if (approvedButNoFormalRecord.length > 0) {
    console.log("");
    console.log("Nota:");
    console.log("Hay documentos en approved sin registro formal. Esto puede ser normal para documentos semilla creados antes del flujo approve-knowledge.");
  }

  console.log("");
}

main();
