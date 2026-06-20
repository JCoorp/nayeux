import fs from "fs";
import path from "path";

const OPENCLAW_ROOT = path.resolve("F:/NayeVault/openclaw");
const FRESH_ROOT = path.join(OPENCLAW_ROOT, "fresh");
const STAGING_DIR = path.join(OPENCLAW_ROOT, "staging");

const requiredDirs = [
  "config",
  "agents",
  "tools",
  "prompts",
  "docs",
  "runtime",
  "logs"
];

const requiredFiles = [
  "SECURITY_POLICY.md"
];

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function listFiles(dirPath) {
  if (!exists(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort();
}

function checkFreshSetup() {
  const dirChecks = requiredDirs.map(dirName => {
    const fullPath = path.join(FRESH_ROOT, dirName);

    return {
      type: "directory",
      name: dirName,
      path: fullPath,
      ok: exists(fullPath)
    };
  });

  const fileChecks = requiredFiles.map(fileName => {
    const fullPath = path.join(FRESH_ROOT, fileName);

    return {
      type: "file",
      name: fileName,
      path: fullPath,
      ok: exists(fullPath)
    };
  });

  const stagingFiles = listFiles(STAGING_DIR);
  const oldBackupFiles = stagingFiles.filter(file => {
    const lower = file.toLowerCase();
    return lower.includes("openclaw") && (lower.endsWith(".tar.gz") || lower.endsWith(".tgz") || lower.endsWith(".tar"));
  });

  const allChecks = [...dirChecks, ...fileChecks];
  const structureOk = allChecks.every(check => check.ok);
  const oldBackupDetected = oldBackupFiles.length > 0;

  return {
    structureOk,
    oldBackupDetected,
    oldBackupFiles,
    dirChecks,
    fileChecks,
    status: structureOk && !oldBackupDetected ? "OK" : "REVISAR"
  };
}

const result = checkFreshSetup();

console.log("");
console.log("Naye OpenClaw Fresh Status");
console.log("--------------------------");
console.log("Fresh root:", FRESH_ROOT);
console.log("Staging:", STAGING_DIR);
console.log("");

console.log("Estructura requerida");
console.log("--------------------");

for (const check of result.dirChecks) {
  console.log(`[${check.ok ? "OK" : "FALTA"}] ${check.type}: ${check.name}`);
}

for (const check of result.fileChecks) {
  console.log(`[${check.ok ? "OK" : "FALTA"}] ${check.type}: ${check.name}`);
}

console.log("");
console.log("Backup antiguo en staging");
console.log("-------------------------");

if (result.oldBackupDetected) {
  for (const file of result.oldBackupFiles) {
    console.log(`[REVISAR] ${file}`);
  }
} else {
  console.log("[OK] No se detectó backup antiguo de OpenClaw en staging");
}

console.log("");
console.log("Resumen");
console.log("-------");
console.log("Estructura fresh:", result.structureOk ? "OK" : "REVISAR");
console.log("Backup antiguo detectado:", result.oldBackupDetected ? "SÍ" : "NO");
console.log("Estado:", result.status);
console.log("");

if (result.status !== "OK") {
  process.exit(1);
}
