import fs from "fs";
import path from "path";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const ACTIVE_DIR = path.join(ROOT, "generated-tools", "active");
const REGISTRY_PATH = path.join(ROOT, "config", "tool-registry.json");

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

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`No existe ${label}: ${targetPath}`);
  }
}

function activateTool(toolName) {
  if (!toolName) {
    throw new Error('Uso: npm run activate-tool -- "systemStatus"');
  }

  assertExists(REGISTRY_PATH, "tool-registry.json");

  const registry = readJson(REGISTRY_PATH);

  if (!Array.isArray(registry.tools)) {
    throw new Error("El registro no contiene un arreglo tools válido.");
  }

  const toolIndex = registry.tools.findIndex(tool => tool.name === toolName);

  if (toolIndex < 0) {
    throw new Error(`No existe una herramienta registrada llamada: ${toolName}`);
  }

  const tool = registry.tools[toolIndex];

  if (tool.status !== "approved") {
    throw new Error(`La herramienta no está aprobada. Estado actual: ${tool.status}`);
  }

  if (tool.activationStatus !== "approved_not_active") {
    throw new Error(`La herramienta no está lista para activarse. activationStatus actual: ${tool.activationStatus}`);
  }

  if (tool.riskLevel !== "low") {
    throw new Error("Solo se permite activar herramientas de riesgo bajo en esta fase.");
  }

  if (!tool.dryRunPassed) {
    throw new Error("La herramienta no tiene dryRunPassed=true.");
  }

  if (tool.usesNetwork || tool.usesExternalProvider) {
    throw new Error("La herramienta usa red o proveedor externo. No puede activarse en esta fase.");
  }

  if (!tool.permissions?.readOnly) {
    throw new Error("La herramienta no está marcada como readOnly.");
  }

  assertExists(tool.packageDir, "carpeta approved de la herramienta");

  ensureDir(ACTIVE_DIR);

  const activePackageDir = path.join(ACTIVE_DIR, tool.packageName);

  if (!fs.existsSync(activePackageDir)) {
    fs.cpSync(tool.packageDir, activePackageDir, { recursive: true });
  }

  const manifestPath = path.join(activePackageDir, "manifest.json");
  assertExists(manifestPath, "manifest activo");

  const manifest = readJson(manifestPath);

  manifest.status = "active";
  manifest.activatedAt = new Date().toISOString();
  manifest.authorizationRole = "Usuario Administrador designado";

  if (manifest.tool) {
    manifest.tool.activationStatus = "active";
  }

  writeJson(manifestPath, manifest);

  registry.tools[toolIndex] = {
    ...tool,
    status: "active",
    activationStatus: "active",
    activePackageDir,
    activatedAt: new Date().toISOString(),
    activatedByRole: "Usuario Administrador designado",
    notes: "Herramienta activa de bajo riesgo, solo lectura, sin red y sin proveedor externo."
  };

  writeJson(REGISTRY_PATH, registry);

  return {
    toolName,
    packageName: tool.packageName,
    status: "active",
    activePackageDir
  };
}

try {
  const toolName = process.argv[2];
  const result = activateTool(toolName);

  console.log("");
  console.log("Naye Tool Activator");
  console.log("-------------------");
  console.log("Herramienta activada:", result.toolName);
  console.log("Paquete:", result.packageName);
  console.log("Estado:", result.status);
  console.log("Carpeta activa:", result.activePackageDir);
  console.log("");
} catch (error) {
  console.error("");
  console.error("Naye Tool Activator — Error");
  console.error("---------------------------");
  console.error(error.message);
  console.error("");
  process.exit(1);
}
