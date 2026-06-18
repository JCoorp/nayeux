import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const PROPOSED_DIR = path.join(ROOT, "generated-tools", "proposed");
const APPROVED_DIR = path.join(ROOT, "generated-tools", "approved");
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

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Falta archivo requerido: ${label} -> ${filePath}`);
  }
}

function copyDirectory(source, destination) {
  if (fs.existsSync(destination)) {
    throw new Error(`La carpeta destino ya existe: ${destination}`);
  }

  fs.cpSync(source, destination, { recursive: true });
}

function runDryRunTest(packageDir, manifest) {
  const testPath = path.join(packageDir, manifest.files.test);

  assertFileExists(testPath, "test dry_run");

  const output = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", testPath],
    { encoding: "utf8" }
  );

  return output.trim();
}

function validateManifest(manifest) {
  if (!manifest.tool) {
    throw new Error("El manifest no contiene sección tool.");
  }

  if (!manifest.tool.name) {
    throw new Error("El manifest no contiene tool.name.");
  }

  if (!manifest.tool.riskLevel) {
    throw new Error("El manifest no contiene tool.riskLevel.");
  }

  if (!manifest.tool.recommendedLanguage) {
    throw new Error("El manifest no contiene tool.recommendedLanguage.");
  }

  if (manifest.tool.riskLevel !== "low") {
    throw new Error("Esta primera versión del aprobador solo permite aprobar herramientas de riesgo bajo.");
  }

  if (!manifest.tool.permissions?.readOnly) {
    throw new Error("La herramienta no está marcada como readOnly.");
  }

  if (manifest.tool.permissions?.usesNetwork) {
    throw new Error("La herramienta declara uso de red. No puede aprobarse en esta fase.");
  }

  if (manifest.tool.permissions?.usesExternalProvider) {
    throw new Error("La herramienta declara proveedor externo. No puede aprobarse en esta fase.");
  }
}

function validatePackageFiles(packageDir, manifest) {
  assertFileExists(path.join(packageDir, manifest.files.manifest), "manifest.json");
  assertFileExists(path.join(packageDir, manifest.files.readme), "README.md");
  assertFileExists(path.join(packageDir, manifest.files.security), "SECURITY.md");
  assertFileExists(path.join(packageDir, manifest.files.implementation), "implementación");
  assertFileExists(path.join(packageDir, manifest.files.test), "test");
  assertFileExists(path.join(packageDir, manifest.files.bridge), "bridge");
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return {
      registry_name: "Naye Tool Registry",
      version: "0.1.0",
      authorization_role: "Usuario Administrador designado",
      tools: []
    };
  }

  return readJson(REGISTRY_PATH);
}

function updateRegistry({ registry, manifest, approvedPackageDir, packageName, dryRunOutput }) {
  const existingIndex = registry.tools.findIndex(tool => {
    return tool.name === manifest.tool.name;
  });

  const entry = {
    name: manifest.tool.name,
    displayName: manifest.tool.displayName,
    status: "approved",
    packageName,
    packageDir: approvedPackageDir,
    riskLevel: manifest.tool.riskLevel,
    recommendedLanguage: manifest.tool.recommendedLanguage,
    integrationLanguage: manifest.tool.integrationLanguage,
    permissions: manifest.tool.permissions,
    requiresConfirmation: false,
    usesNetwork: manifest.tool.permissions.usesNetwork,
    usesExternalProvider: manifest.tool.permissions.usesExternalProvider,
    approvedAt: new Date().toISOString(),
    authorizedByRole: "Usuario Administrador designado",
    dryRunPassed: true,
    dryRunSummary: dryRunOutput.includes("dry_run test passed")
      ? "dry_run test passed"
      : "dry_run executed; review output manually",
    activationStatus: "approved_not_active",
    notes: "Aprobada como herramienta de bajo riesgo en modo solo lectura. No está activa todavía."
  };

  if (existingIndex >= 0) {
    registry.tools[existingIndex] = entry;
  } else {
    registry.tools.push(entry);
  }

  return registry;
}

function approveTool(packageName) {
  if (!packageName) {
    throw new Error('Uso: npm run approve-tool -- "nombre_del_paquete"');
  }

  const proposedPackageDir = path.join(PROPOSED_DIR, packageName);
  const approvedPackageDir = path.join(APPROVED_DIR, packageName);

  if (!fs.existsSync(proposedPackageDir)) {
    throw new Error(`No existe el paquete propuesto: ${proposedPackageDir}`);
  }

  ensureDir(APPROVED_DIR);

  const manifestPath = path.join(proposedPackageDir, "manifest.json");
  assertFileExists(manifestPath, "manifest.json");

  const manifest = readJson(manifestPath);

  validateManifest(manifest);
  validatePackageFiles(proposedPackageDir, manifest);

  const dryRunOutput = runDryRunTest(proposedPackageDir, manifest);

  copyDirectory(proposedPackageDir, approvedPackageDir);

  const approvedManifestPath = path.join(approvedPackageDir, "manifest.json");
  const approvedManifest = readJson(approvedManifestPath);

  approvedManifest.status = "approved";
  approvedManifest.approvedAt = new Date().toISOString();
  approvedManifest.tool.activationStatus = "approved_not_active";
  approvedManifest.authorizationRole = "Usuario Administrador designado";

  writeJson(approvedManifestPath, approvedManifest);

  const registry = loadRegistry();
  const updatedRegistry = updateRegistry({
    registry,
    manifest: approvedManifest,
    approvedPackageDir,
    packageName,
    dryRunOutput
  });

  writeJson(REGISTRY_PATH, updatedRegistry);

  return {
    approved: true,
    packageName,
    toolName: approvedManifest.tool.name,
    status: "approved_not_active",
    approvedPackageDir,
    registryPath: REGISTRY_PATH,
    dryRunOutput
  };
}

const packageName = process.argv[2];

try {
  const result = approveTool(packageName);

  console.log("");
  console.log("Naye Tool Approver");
  console.log("------------------");
  console.log("Herramienta aprobada:", result.toolName);
  console.log("Paquete:", result.packageName);
  console.log("Estado:", result.status);
  console.log("Carpeta aprobada:", result.approvedPackageDir);
  console.log("Registro:", result.registryPath);
  console.log("");
  console.log("Resultado dry_run:");
  console.log(result.dryRunOutput);
  console.log("");
} catch (error) {
  console.error("");
  console.error("Naye Tool Approver — Error");
  console.error("--------------------------");
  console.error(error.message);
  console.error("");
  process.exit(1);
}
