import fs from "fs";
import path from "path";

const NAYE_CORE_ROOT = path.resolve("F:/NayeVault/naye-core");
const OPENCLAW_ROOT = path.resolve("F:/NayeVault/openclaw");
const FRESH_ROOT = path.join(OPENCLAW_ROOT, "fresh");
const STAGING_DIR = path.join(OPENCLAW_ROOT, "staging");

const FRESH_CONFIG_PATH = path.join(FRESH_ROOT, "config", "openclaw.fresh.config.json");
const BRIDGE_CONFIG_PATH = path.join(NAYE_CORE_ROOT, "config", "openclaw-bridge.config.json");

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
  "SECURITY_POLICY.md",
  "config/openclaw.fresh.config.json"
];

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
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

function checkFreshConfig() {
  if (!exists(FRESH_CONFIG_PATH)) {
    return {
      ok: false,
      message: "No existe openclaw.fresh.config.json"
    };
  }

  const config = readJson(FRESH_CONFIG_PATH);

  const security = config.security ?? {};
  const integration = config.integration ?? {};

  const ok =
    config.mode === "fresh" &&
    config.managedBy === "Naye Core" &&
    security.restoreOldBackup === false &&
    security.allowLegacyCredentials === false &&
    security.allowLegacySessions === false &&
    security.allowTokens === false &&
    security.allowNetworkByDefault === false &&
    security.requireApprovalForSensitiveActions === true &&
    integration.nayeCoreBridgeEnabled === false &&
    integration.status === "prepared_not_connected";

  return {
    ok,
    mode: config.mode,
    managedBy: config.managedBy,
    restoreOldBackup: security.restoreOldBackup,
    allowLegacyCredentials: security.allowLegacyCredentials,
    allowLegacySessions: security.allowLegacySessions,
    allowTokens: security.allowTokens,
    allowNetworkByDefault: security.allowNetworkByDefault,
    requireApprovalForSensitiveActions: security.requireApprovalForSensitiveActions,
    nayeCoreBridgeEnabled: integration.nayeCoreBridgeEnabled,
    integrationStatus: integration.status,
    message: ok
      ? "Configuración fresh segura"
      : "Configuración fresh requiere revisión"
  };
}

function checkBridgeConfig() {
  if (!exists(BRIDGE_CONFIG_PATH)) {
    return {
      ok: false,
      message: "No existe openclaw-bridge.config.json"
    };
  }

  const config = readJson(BRIDGE_CONFIG_PATH);

  const rules = config.rules ?? {};
  const status = config.status ?? {};

  const ok =
    config.enabled === false &&
    config.mode === "fresh_only" &&
    rules.restoreOldBackup === false &&
    rules.readOldBackup === false &&
    rules.migrateCredentials === false &&
    rules.migrateSessions === false &&
    rules.migrateCookies === false &&
    rules.migrateTokens === false &&
    rules.allowNetworkByDefault === false &&
    rules.allowExternalProviderByDefault === false &&
    rules.requireApprovalForSensitiveActions === true &&
    status.bridgePrepared === true &&
    status.operationalConnection === false;

  return {
    ok,
    enabled: config.enabled,
    mode: config.mode,
    restoreOldBackup: rules.restoreOldBackup,
    readOldBackup: rules.readOldBackup,
    migrateCredentials: rules.migrateCredentials,
    migrateSessions: rules.migrateSessions,
    migrateCookies: rules.migrateCookies,
    migrateTokens: rules.migrateTokens,
    allowNetworkByDefault: rules.allowNetworkByDefault,
    allowExternalProviderByDefault: rules.allowExternalProviderByDefault,
    requireApprovalForSensitiveActions: rules.requireApprovalForSensitiveActions,
    bridgePrepared: status.bridgePrepared,
    operationalConnection: status.operationalConnection,
    message: ok
      ? "Bridge preparado y desconectado operativamente"
      : "Bridge requiere revisión"
  };
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

  const freshConfig = checkFreshConfig();
  const bridgeConfig = checkBridgeConfig();

  const allChecks = [...dirChecks, ...fileChecks];
  const structureOk = allChecks.every(check => check.ok);
  const oldBackupDetected = oldBackupFiles.length > 0;

  const status =
    structureOk &&
    !oldBackupDetected &&
    freshConfig.ok &&
    bridgeConfig.ok
      ? "OK"
      : "REVISAR";

  return {
    structureOk,
    oldBackupDetected,
    oldBackupFiles,
    dirChecks,
    fileChecks,
    freshConfig,
    bridgeConfig,
    status
  };
}

const result = checkFreshSetup();

console.log("");
console.log("Naye OpenClaw Fresh Status");
console.log("--------------------------");
console.log("Fresh root:", FRESH_ROOT);
console.log("Staging:", STAGING_DIR);
console.log("Fresh config:", FRESH_CONFIG_PATH);
console.log("Bridge config:", BRIDGE_CONFIG_PATH);
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
console.log("Configuración Fresh");
console.log("-------------------");
console.log(`[${result.freshConfig.ok ? "OK" : "REVISAR"}] ${result.freshConfig.message}`);
console.log("Modo:", result.freshConfig.mode);
console.log("Managed by:", result.freshConfig.managedBy);
console.log("Restaurar backup viejo:", result.freshConfig.restoreOldBackup);
console.log("Credenciales heredadas:", result.freshConfig.allowLegacyCredentials);
console.log("Sesiones heredadas:", result.freshConfig.allowLegacySessions);
console.log("Tokens heredados:", result.freshConfig.allowTokens);
console.log("Red por defecto:", result.freshConfig.allowNetworkByDefault);
console.log("Requiere aprobación sensible:", result.freshConfig.requireApprovalForSensitiveActions);
console.log("Bridge habilitado en Fresh:", result.freshConfig.nayeCoreBridgeEnabled);
console.log("Estado integración:", result.freshConfig.integrationStatus);

console.log("");
console.log("Configuración Bridge");
console.log("--------------------");
console.log(`[${result.bridgeConfig.ok ? "OK" : "REVISAR"}] ${result.bridgeConfig.message}`);
console.log("Bridge enabled:", result.bridgeConfig.enabled);
console.log("Modo:", result.bridgeConfig.mode);
console.log("Restaurar backup viejo:", result.bridgeConfig.restoreOldBackup);
console.log("Leer backup viejo:", result.bridgeConfig.readOldBackup);
console.log("Migrar credenciales:", result.bridgeConfig.migrateCredentials);
console.log("Migrar sesiones:", result.bridgeConfig.migrateSessions);
console.log("Migrar cookies:", result.bridgeConfig.migrateCookies);
console.log("Migrar tokens:", result.bridgeConfig.migrateTokens);
console.log("Red por defecto:", result.bridgeConfig.allowNetworkByDefault);
console.log("Proveedor externo por defecto:", result.bridgeConfig.allowExternalProviderByDefault);
console.log("Requiere aprobación sensible:", result.bridgeConfig.requireApprovalForSensitiveActions);
console.log("Bridge preparado:", result.bridgeConfig.bridgePrepared);
console.log("Conexión operativa:", result.bridgeConfig.operationalConnection);

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
console.log("Fresh config:", result.freshConfig.ok ? "OK" : "REVISAR");
console.log("Bridge config:", result.bridgeConfig.ok ? "OK" : "REVISAR");
console.log("Backup antiguo detectado:", result.oldBackupDetected ? "SÍ" : "NO");
console.log("Estado:", result.status);
console.log("");

if (result.status !== "OK") {
  process.exit(1);
}
