import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";

const OPENCLAW_ROOT = path.resolve("F:/NayeVault/openclaw");
const STAGING_DIR = path.join(OPENCLAW_ROOT, "staging");
const INVENTORY_DIR = path.join(OPENCLAW_ROOT, "inventory");
const LOGS_DIR = path.join(OPENCLAW_ROOT, "logs");

const SENSITIVE_PATTERNS = [
  "credential",
  "credentials",
  "secret",
  "secrets",
  "token",
  "tokens",
  "cookie",
  "cookies",
  "session",
  "sessions",
  "password",
  "passwd",
  "private",
  "privatekey",
  "id_rsa",
  "id_ed25519",
  ".ssh",
  ".env",
  "env.local",
  "apikey",
  "api_key",
  "auth",
  "oauth",
  "whatsapp",
  "chrome",
  "edge",
  "firefox",
  "browser",
  "profile",
  "login",
  "keychain"
];

const REVIEW_PATTERNS = [
  "config",
  "settings",
  "agent",
  "agents",
  "prompt",
  "prompts",
  "manifest",
  "workflow",
  "tool",
  "tools",
  "script",
  "scripts",
  "json",
  "yaml",
  "yml",
  "md",
  "txt"
];

const SAFE_EXTENSIONS = [
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".js",
  ".mjs",
  ".ts",
  ".ps1",
  ".sh"
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizeForScan(value) {
  return value.toLowerCase().replaceAll("\\", "/");
}

function classifyEntry(entryPath) {
  const normalized = normalizeForScan(entryPath);
  const ext = path.extname(entryPath).toLowerCase();

  const sensitiveMatches = SENSITIVE_PATTERNS.filter(pattern => normalized.includes(pattern));
  const reviewMatches = REVIEW_PATTERNS.filter(pattern => normalized.includes(pattern));

  if (sensitiveMatches.length > 0) {
    return {
      classification: "sensitive",
      reason: `Coincidencias sensibles: ${sensitiveMatches.join(", ")}`
    };
  }

  if (SAFE_EXTENSIONS.includes(ext) && reviewMatches.length > 0) {
    return {
      classification: "review",
      reason: `Archivo potencialmente útil, requiere revisión: ${reviewMatches.join(", ")}`
    };
  }

  if (SAFE_EXTENSIONS.includes(ext)) {
    return {
      classification: "review",
      reason: "Extensión legible permitida, requiere revisión manual"
    };
  }

  return {
    classification: "unknown",
    reason: "No clasificado automáticamente"
  };
}

function walkDirectory(dirPath, rootDir = dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = [];

  for (const item of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, item.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (item.isDirectory()) {
      entries.push({
        sourceType: "directory",
        path: relativePath,
        fullPath,
        sizeBytes: null,
        sha256: null,
        ...classifyEntry(relativePath)
      });

      entries.push(...walkDirectory(fullPath, rootDir));
      continue;
    }

    if (item.isFile()) {
      const stat = fs.statSync(fullPath);

      entries.push({
        sourceType: "file",
        path: relativePath,
        fullPath,
        sizeBytes: stat.size,
        sha256: sha256File(fullPath),
        ...classifyEntry(relativePath)
      });
    }
  }

  return entries;
}

function listTarArchive(archivePath) {
  try {
    const output = execFileSync("tar", ["-tf", archivePath], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 50
    });

    return output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(entryPath => ({
        sourceType: "archive-entry",
        archivePath,
        path: entryPath,
        fullPath: `${archivePath}::${entryPath}`,
        sizeBytes: null,
        sha256: null,
        ...classifyEntry(entryPath)
      }));
  } catch (error) {
    return [{
      sourceType: "archive-error",
      archivePath,
      path: path.basename(archivePath),
      fullPath: archivePath,
      sizeBytes: fs.existsSync(archivePath) ? fs.statSync(archivePath).size : null,
      sha256: fs.existsSync(archivePath) ? sha256File(archivePath) : null,
      classification: "review",
      reason: `No se pudo listar el archivo con tar -tf: ${error.message}`
    }];
  }
}

function inventoryStaging() {
  ensureDir(STAGING_DIR);
  ensureDir(INVENTORY_DIR);
  ensureDir(LOGS_DIR);

  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const stagingEntries = walkDirectory(STAGING_DIR);

  const archiveFiles = stagingEntries
    .filter(entry => entry.sourceType === "file")
    .filter(entry => {
      const normalized = normalizeForScan(entry.path);
      return normalized.endsWith(".tar.gz") ||
        normalized.endsWith(".tgz") ||
        normalized.endsWith(".tar");
    });

  const archiveEntries = archiveFiles.flatMap(entry => listTarArchive(entry.fullPath));

  const allEntries = [
    ...stagingEntries,
    ...archiveEntries
  ].sort((a, b) => a.classification.localeCompare(b.classification) || a.path.localeCompare(b.path));

  const counts = allEntries.reduce((acc, entry) => {
    acc[entry.classification] = (acc[entry.classification] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    system: "Naye Core",
    component: "OpenClaw Inventory",
    generatedAt: new Date().toISOString(),
    policy: {
      restoreAutomatically: false,
      extractAutomatically: false,
      migrateCredentials: false,
      requiresManualApproval: true
    },
    paths: {
      openclawRoot: OPENCLAW_ROOT,
      stagingDir: STAGING_DIR,
      inventoryDir: INVENTORY_DIR,
      logsDir: LOGS_DIR
    },
    summary: {
      totalEntries: allEntries.length,
      counts
    },
    entries: allEntries
  };

  const jsonPath = path.join(INVENTORY_DIR, `openclaw-inventory-${timestamp}.json`);
  const mdPath = path.join(INVENTORY_DIR, `openclaw-inventory-${timestamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const md = [
    "# OpenClaw Inventory",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Policy",
    "",
    "- Restore automatically: false",
    "- Extract automatically: false",
    "- Migrate credentials: false",
    "- Requires manual approval: true",
    "",
    "## Summary",
    "",
    `- Total entries: ${report.summary.totalEntries}`,
    `- Sensitive: ${counts.sensitive ?? 0}`,
    `- Review: ${counts.review ?? 0}`,
    `- Unknown: ${counts.unknown ?? 0}`,
    `- Archive errors: ${counts["archive-error"] ?? 0}`,
    "",
    "## Entries",
    "",
    ...allEntries.map(entry => `- [${entry.classification}] ${entry.path} — ${entry.reason}`)
  ].join("\n");

  fs.writeFileSync(mdPath, md, "utf8");

  return {
    report,
    jsonPath,
    mdPath
  };
}

try {
  const result = inventoryStaging();

  console.log("");
  console.log("Naye OpenClaw Inventory");
  console.log("-----------------------");
  console.log("Staging:", STAGING_DIR);
  console.log("Inventario JSON:", result.jsonPath);
  console.log("Inventario MD:", result.mdPath);
  console.log("");
  console.log("Resumen:");
  console.log("Total:", result.report.summary.totalEntries);
  console.log("Sensitive:", result.report.summary.counts.sensitive ?? 0);
  console.log("Review:", result.report.summary.counts.review ?? 0);
  console.log("Unknown:", result.report.summary.counts.unknown ?? 0);
  console.log("Archive errors:", result.report.summary.counts["archive-error"] ?? 0);
  console.log("");
  console.log("No se restauró ni se extrajo ningún archivo.");
  console.log("");
} catch (error) {
  console.error("");
  console.error("Naye OpenClaw Inventory — Error");
  console.error("-------------------------------");
  console.error(error.message);
  console.error("");
  process.exit(1);
}
