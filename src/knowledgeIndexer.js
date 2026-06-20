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

function hashContent(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function createPreview(content) {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 800
    ? normalized.slice(0, 800) + "..."
    : normalized;
}

function buildKnowledgeIndex() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`No existe configuración de conocimiento: ${CONFIG_PATH}`);
  }

  const config = readJson(CONFIG_PATH);

  if (!config.enabled) {
    return {
      enabled: false,
      indexedAt: new Date().toISOString(),
      documents: [],
      message: "La memoria documental está deshabilitada."
    };
  }

  const approvedDir = path.resolve(config.approvedDir);
  const indexDir = path.resolve(config.indexDir);
  const indexFile = path.resolve(config.indexFile);
  const allowedExtensions = config.allowedExtensions ?? [".md", ".txt", ".json"];
  const maxFileSizeBytes = Number(config.maxFileSizeKB ?? 512) * 1024;

  ensureDir(approvedDir);
  ensureDir(indexDir);

  const files = walkFiles(approvedDir);
  const documents = [];
  const skipped = [];

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);

    if (!allowedExtensions.includes(ext)) {
      skipped.push({
        path: filePath,
        reason: `Extensión no permitida: ${ext}`
      });
      continue;
    }

    if (stat.size > maxFileSizeBytes) {
      skipped.push({
        path: filePath,
        reason: `Archivo excede maxFileSizeKB=${config.maxFileSizeKB}`
      });
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const relativePath = path.relative(approvedDir, filePath);

    documents.push({
      id: hashContent(relativePath + "::" + content).slice(0, 16),
      title: path.basename(filePath),
      path: filePath,
      relativePath,
      extension: ext,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      sha256: hashContent(content),
      preview: createPreview(content)
    });
  }

  const index = {
    system: "Naye Core",
    component: "Knowledge Index",
    enabled: true,
    readOnly: true,
    allowNetwork: false,
    allowExternalProvider: false,
    indexedAt: new Date().toISOString(),
    approvedDir,
    documentCount: documents.length,
    skippedCount: skipped.length,
    documents,
    skipped
  };

  writeJson(indexFile, index);

  return index;
}

try {
  const index = buildKnowledgeIndex();

  console.log("");
  console.log("Naye Knowledge Indexer");
  console.log("----------------------");
  console.log("Estado:", index.enabled ? "enabled" : "disabled");
  console.log("Documentos indexados:", index.documentCount ?? 0);
  console.log("Documentos omitidos:", index.skippedCount ?? 0);
  console.log("Índice:", path.resolve("F:/NayeVault/knowledge/index/knowledge-index.json"));
  console.log("");

  if (index.documents?.length) {
    console.log("Documentos:");
    for (const doc of index.documents) {
      console.log(`- ${doc.title} (${doc.relativePath})`);
    }
    console.log("");
  }
} catch (error) {
  console.error("");
  console.error("Naye Knowledge Indexer — Error");
  console.error("------------------------------");
  console.error(error.message);
  console.error("");
  process.exit(1);
}
